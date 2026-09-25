"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile, type CurrentProfile } from "@/lib/data/get-dataset";
import type { LiveStreamAudience } from "@/lib/supabase/types";
import { activeVideoProvider, getVideoProvider } from "@/lib/video/providers";
import { syncLiveStream } from "@/lib/video/live-stream-sync";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireManager(): Promise<{ ok: true; profile: CurrentProfile; supabase: Supabase } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_livestreams")) return { ok: false, error: "Not permitted." };
  return { ok: true, profile, supabase: await createClient() };
}

function refresh(streamId?: string) {
  revalidatePath("/live");
  if (streamId) revalidatePath(`/live/${streamId}`);
}

export type LiveStreamInput = {
  title: string;
  description?: string;
  scheduledAt: string; // ISO
  audience: LiveStreamAudience;
  churchIds: string[];
  chatEnabled: boolean;
};

function validate(input: LiveStreamInput): string | null {
  if (!input.title.trim()) return "Give the stream a title.";
  if (Number.isNaN(Date.parse(input.scheduledAt))) return "Pick when it starts.";
  if (!["zone", "chapters", "leaders"].includes(input.audience)) return "Choose who can watch.";
  if (input.audience === "chapters" && input.churchIds.length === 0) return "Choose at least one chapter.";
  return null;
}

function columns(input: LiveStreamInput) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    scheduled_at: new Date(input.scheduledAt).toISOString(),
    audience: input.audience,
    church_ids: input.audience === "chapters" ? input.churchIds : [],
    chat_enabled: input.chatEnabled,
  };
}

// Creates the stream here and at the video host. The host's stream key is
// kept in a table only stream managers can read.
export async function scheduleLiveStream(input: LiveStreamInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;

  const provider = activeVideoProvider();
  if (!provider) return { ok: false, error: "Livestreaming needs a video host. Add the Mux keys to the server's environment first." };

  const { data: row, error } = await supabase
    .from("live_streams")
    .insert({ zone_id: profile.zoneId, created_by: profile.userId, provider: provider.id, ...columns(input) })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: error?.message ?? "Could not schedule the stream." };

  try {
    const live = await provider.createLiveStream({ ref: row.id });
    const [{ error: updateError }, { error: keyError }] = await Promise.all([
      supabase.from("live_streams").update({ provider_stream_id: live.streamId, playback_id: live.playbackId }).eq("id", row.id),
      supabase.from("live_stream_keys").insert({ stream_id: row.id, zone_id: profile.zoneId, stream_key: live.streamKey }),
    ]);
    if (updateError || keyError) {
      await provider.deleteLiveStream(live.streamId);
      throw new Error((updateError ?? keyError)!.message);
    }
  } catch (e) {
    await supabase.from("live_streams").delete().eq("id", row.id);
    return { ok: false, error: `The video host couldn't set up the stream: ${e instanceof Error ? e.message : "unknown error"}` };
  }

  await logAudit(profile, "livestream.create", `Scheduled "${input.title.trim()}"`);
  refresh();
  return { ok: true, id: row.id };
}

export async function updateLiveStream(streamId: string, input: LiveStreamInput): Promise<ActionResult> {
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;

  const { data, error } = await supabase.from("live_streams").update(columns(input)).eq("id", streamId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "That stream no longer exists." };

  await logAudit(profile, "livestream.update", `Edited "${input.title.trim()}"`);
  refresh(streamId);
  return { ok: true };
}

// Ends the broadcast now (or closes a stream that never went live). The
// recording, if there was a broadcast, arrives shortly afterwards.
export async function endLiveStream(streamId: string): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;

  const { data: stream } = await supabase.from("live_streams").select("title, status, provider, provider_stream_id").eq("id", streamId).maybeSingle();
  if (!stream) return { ok: false, error: "That stream no longer exists." };
  if (stream.status === "ended") return { ok: true };

  const provider = getVideoProvider(stream.provider);
  if (stream.provider_stream_id) {
    // Note the recording before the host forgets which asset was current.
    const state = await provider.getLiveStream(stream.provider_stream_id).catch(() => null);
    await provider.endLiveStream(stream.provider_stream_id);
    const { error } = await supabase
      .from("live_streams")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        ...(stream.status === "live" && state?.assetId ? { recording_asset_id: state.assetId, recording_status: "processing" as const } : {}),
      })
      .eq("id", streamId);
    if (error) return { ok: false, error: error.message };
  }

  await logAudit(profile, "livestream.end", `Ended "${stream.title}"`);
  refresh(streamId);
  return { ok: true };
}

export async function deleteLiveStream(streamId: string): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;

  const { data: stream } = await supabase
    .from("live_streams")
    .select("title, provider, provider_stream_id, recording_asset_id")
    .eq("id", streamId)
    .maybeSingle();
  if (!stream) return { ok: false, error: "That stream no longer exists." };

  const { error } = await supabase.from("live_streams").delete().eq("id", streamId);
  if (error) return { ok: false, error: error.message };
  const provider = getVideoProvider(stream.provider);
  if (stream.provider_stream_id) await provider.deleteLiveStream(stream.provider_stream_id);
  if (stream.recording_asset_id) await provider.deleteAsset(stream.recording_asset_id);

  await logAudit(profile, "livestream.delete", `Deleted "${stream.title}" and its replay`);
  refresh();
  return { ok: true };
}

// Fallback for deployments without webhooks: the host's page asks now and
// then, and the result reaches every viewer through Realtime.
export async function refreshLiveStatus(streamId: string): Promise<{ status: "scheduled" | "live" | "ended" | null }> {
  const profile = await getCurrentProfile();
  if (!profile || !can(profile, "manage_livestreams")) return { status: null };
  const supabase = await createClient();
  const { data } = await supabase.from("live_streams").select("id").eq("id", streamId).maybeSingle();
  if (!data) return { status: null };
  try {
    return { status: await syncLiveStream(streamId) };
  } catch {
    return { status: null };
  }
}

// ── Chat ────────────────────────────────────────────────────────────────

export async function sendChatMessage(streamId: string, body: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  const text = body.trim().replace(/\s+\n/g, "\n");
  if (!text) return { ok: false, error: "Type a message first." };
  if (text.length > 500) return { ok: false, error: "Keep it under 500 characters." };

  const supabase = await createClient();
  // RLS checks the viewer may watch, the stream isn't over, chat is on and
  // they aren't muted.
  const { error } = await supabase.from("live_stream_messages").insert({
    stream_id: streamId,
    zone_id: profile.zoneId,
    profile_id: profile.userId,
    author_name: profile.fullName,
    body: text,
  });
  if (error) return { ok: false, error: "Your message couldn't be sent — chat may be closed for you." };
  return { ok: true };
}

export async function deleteChatMessage(messageId: string): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const { error } = await supabase
    .from("live_stream_messages")
    .update({ deleted_at: new Date().toISOString(), deleted_by: profile.userId })
    .eq("id", messageId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setViewerMuted(streamId: string, profileId: string, muted: boolean): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  if (profileId === profile.userId) return { ok: false, error: "You can't mute yourself." };

  const { error } = muted
    ? await supabase.from("live_stream_mutes").upsert({ stream_id: streamId, profile_id: profileId, zone_id: profile.zoneId, created_by: profile.userId })
    : await supabase.from("live_stream_mutes").delete().eq("stream_id", streamId).eq("profile_id", profileId);
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, muted ? "livestream.mute" : "livestream.unmute", `${muted ? "Muted" : "Unmuted"} someone in a stream's chat`);
  return { ok: true };
}

export async function setChatEnabled(streamId: string, enabled: boolean): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase.from("live_streams").update({ chat_enabled: enabled }).eq("id", streamId);
  if (error) return { ok: false, error: error.message };
  refresh(streamId);
  return { ok: true };
}

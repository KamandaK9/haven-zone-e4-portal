import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { VideoProviderId } from "./provider";
import { getVideoProvider } from "./providers";
import type { AssetState, LiveStreamState } from "./providers/types";

// Moves a livestream scheduled → live → ended, and its recording through
// processing → ready, as the video host reports it. Called from the host's
// webhook and, as a fallback when webhooks aren't set up (e.g. local dev),
// from the host's page polling. Service-role client: webhooks have no user
// session. Every change here is pushed to open pages by Supabase Realtime.

function refreshLivePages(streamId: string) {
  revalidatePath("/live");
  revalidatePath(`/live/${streamId}`);
}

export async function applyLiveStreamState(provider: VideoProviderId, state: LiveStreamState): Promise<void> {
  const admin = createAdminClient();
  const { data: stream } = await admin
    .from("live_streams")
    .select("id, status, started_at, recording_asset_id, recording_status")
    .eq("provider", provider)
    .eq("provider_stream_id", state.streamId)
    .maybeSingle();
  if (!stream || stream.status === "ended") return;

  if (state.status === "active" && stream.status === "scheduled") {
    await admin
      .from("live_streams")
      .update({ status: "live", started_at: stream.started_at ?? new Date().toISOString() })
      .eq("id", stream.id);
  } else if (state.status === "idle" && stream.status === "live") {
    // The broadcast finished (the reconnect window has passed). Stop the key
    // working so the page can't be taken live again by accident.
    await admin
      .from("live_streams")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        ...(state.assetId && !stream.recording_asset_id ? { recording_asset_id: state.assetId, recording_status: "processing" as const } : {}),
      })
      .eq("id", stream.id);
    await getVideoProvider(provider).endLiveStream(state.streamId);
  } else {
    return;
  }
  refreshLivePages(stream.id);
}

export async function applyRecordingState(provider: VideoProviderId, asset: AssetState): Promise<void> {
  if (!asset.liveStreamId) return;
  const admin = createAdminClient();
  const { data: stream } = await admin
    .from("live_streams")
    .select("id, recording_asset_id, recording_status")
    .eq("provider", provider)
    .eq("provider_stream_id", asset.liveStreamId)
    .maybeSingle();
  if (!stream) return;
  // A ready recording is never replaced by a later, still-processing one
  // (e.g. a stray reconnect after the stream was over).
  if (stream.recording_status === "ready" && asset.status !== "ready") return;

  if (asset.status === "ready" && asset.playbackId) {
    await admin
      .from("live_streams")
      .update({
        recording_asset_id: asset.assetId,
        recording_playback_id: asset.playbackId,
        recording_duration_seconds: asset.durationSeconds ?? null,
        recording_status: "ready",
      })
      .eq("id", stream.id);
  } else if (asset.status === "processing") {
    await admin.from("live_streams").update({ recording_asset_id: asset.assetId, recording_status: "processing" }).eq("id", stream.id);
  } else {
    await admin.from("live_streams").update({ recording_asset_id: asset.assetId, recording_status: "errored" }).eq("id", stream.id);
  }
  refreshLivePages(stream.id);
}

// Pulls the current state from the host for one stream that isn't settled
// yet. Returns the stream's status afterwards.
export async function syncLiveStream(streamId: string): Promise<"scheduled" | "live" | "ended" | null> {
  const admin = createAdminClient();
  const read = async () =>
    (
      await admin
        .from("live_streams")
        .select("status, provider, provider_stream_id, recording_asset_id, recording_status")
        .eq("id", streamId)
        .maybeSingle()
    ).data;

  let stream = await read();
  if (!stream?.provider_stream_id) return stream?.status ?? null;
  const provider = getVideoProvider(stream.provider);

  if (stream.status !== "ended") {
    await applyLiveStreamState(stream.provider, await provider.getLiveStream(stream.provider_stream_id));
    stream = await read();
    if (!stream) return null;
  }
  if (stream.status === "ended" && stream.recording_asset_id && stream.recording_status !== "ready") {
    const asset = await provider.getAsset(stream.recording_asset_id);
    await applyRecordingState(stream.provider, { ...asset, liveStreamId: stream.provider_stream_id! });
  }
  return stream.status;
}

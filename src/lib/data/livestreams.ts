import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database, LiveStreamAudience, LiveStreamStatus, RecordingStatus } from "@/lib/supabase/types";

export type LiveStream = {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  audience: LiveStreamAudience;
  churchIds: string[];
  status: LiveStreamStatus;
  chatEnabled: boolean;
  hasVideo: boolean;
  recordingStatus: RecordingStatus;
  recordingDurationSeconds?: number;
  startedAt?: string;
  endedAt?: string;
};

export type ChatMessage = {
  id: string;
  profileId: string;
  authorName: string;
  body: string;
  createdAt: string;
  deleted: boolean;
};

type Row = Database["public"]["Tables"]["live_streams"]["Row"];

export function mapLiveStream(s: Row): LiveStream {
  return {
    id: s.id,
    title: s.title,
    description: s.description ?? undefined,
    scheduledAt: s.scheduled_at,
    audience: s.audience,
    churchIds: s.church_ids ?? [],
    status: s.status,
    chatEnabled: s.chat_enabled,
    hasVideo: !!s.provider_stream_id,
    recordingStatus: s.recording_status,
    recordingDurationSeconds: s.recording_duration_seconds === null ? undefined : Number(s.recording_duration_seconds),
    startedAt: s.started_at ?? undefined,
    endedAt: s.ended_at ?? undefined,
  };
}

// Streams the viewer may watch (RLS), newest first. null = not set up yet.
export async function getLiveStreams(zoneId: string): Promise<LiveStream[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("live_streams").select("*").eq("zone_id", zoneId).order("scheduled_at", { ascending: false }).limit(100);
  if (error) return null;
  return data.map(mapLiveStream);
}

export async function getLiveStreamRow(streamId: string): Promise<Row | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("live_streams").select("*").eq("id", streamId).maybeSingle();
  return data;
}

export function mapMessage(m: Database["public"]["Tables"]["live_stream_messages"]["Row"]): ChatMessage {
  return {
    id: m.id,
    profileId: m.profile_id,
    authorName: m.author_name,
    body: m.deleted_at ? "" : m.body,
    createdAt: m.created_at,
    deleted: !!m.deleted_at,
  };
}

export async function getChatMessages(streamId: string, limit = 300): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("live_stream_messages")
    .select("*")
    .eq("stream_id", streamId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse().map(mapMessage);
}

// RLS lets a viewer see only their own mute; managers see everyone's.
export async function getMutedProfileIds(streamId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("live_stream_mutes").select("profile_id").eq("stream_id", streamId);
  return (data ?? []).map((m) => m.profile_id);
}

// Managers only (RLS).
export async function getStreamKey(streamId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("live_stream_keys").select("stream_key").eq("stream_id", streamId).maybeSingle();
  return data?.stream_key ?? null;
}

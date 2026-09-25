import { notFound, redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DeleteStreamButton } from "@/components/live/delete-stream-button";
import { LiveRoom, type Viewer } from "@/components/live/live-room";
import { StreamDialog } from "@/components/live/stream-dialog";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getChatMessages, getLiveStreamRow, getMutedProfileIds, getStreamKey, mapLiveStream } from "@/lib/data/livestreams";
import { getRecordChapters } from "@/lib/data/records";
import { createClient } from "@/lib/supabase/server";
import { getVideoProvider } from "@/lib/video/providers";
import { tenant } from "@/tenant";

export default async function LiveStreamPage({ params }: { params: Promise<{ streamId: string }> }) {
  const { streamId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");

  // RLS returns the stream only to people it's shown to.
  const row = await getLiveStreamRow(streamId);
  if (!row) notFound();
  const stream = mapLiveStream(row);
  const isHost = can(profile, "manage_livestreams");
  const provider = getVideoProvider(row.provider);

  // The live picture while live, the replay once it's ready; tokens are
  // minted per page view.
  const playbackId = row.status === "live" ? row.playback_id : row.status === "ended" && row.recording_status === "ready" ? row.recording_playback_id : null;
  const supabase = await createClient();
  const [playback, messages, mutedIds, streamKey, chapters, myMember] = await Promise.all([
    playbackId && provider.isConfigured() ? provider.playbackSource(playbackId).catch(() => null) : null,
    getChatMessages(streamId),
    getMutedProfileIds(streamId),
    isHost && row.status !== "ended" ? getStreamKey(streamId) : null,
    isHost ? getRecordChapters() : [],
    supabase.from("members").select("avatar_color, photo_url").eq("profile_id", profile.userId).maybeSingle(),
  ]);

  const me: Viewer = {
    profileId: profile.userId,
    name: profile.fullName,
    avatarColor: myMember.data?.avatar_color ?? tenant.avatarColors[0],
    photoUrl: myMember.data?.photo_url ?? undefined,
    leader: profile.role !== "member",
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Breadcrumb items={[{ label: "Live", href: "/live" }, { label: stream.title }]} />
        {isHost && (
          <div className="flex gap-2">
            {stream.status === "scheduled" && <StreamDialog chapters={chapters} stream={stream} />}
            <DeleteStreamButton streamId={stream.id} hasReplay={stream.recordingStatus !== "none"} />
          </div>
        )}
      </div>
      <LiveRoom
        stream={stream}
        playback={playback}
        initialMessages={messages}
        me={me}
        isHost={isHost}
        mutedIds={mutedIds}
        broadcast={streamKey ? { ingestUrl: provider.liveIngestUrl, streamKey } : null}
      />
    </div>
  );
}

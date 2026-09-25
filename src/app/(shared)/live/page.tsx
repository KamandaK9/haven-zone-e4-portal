import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, PlayCircle, Radio } from "lucide-react";
import { StreamDialog } from "@/components/live/stream-dialog";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getLiveStreams, type LiveStream } from "@/lib/data/livestreams";
import { getRecordChapters } from "@/lib/data/records";
import { cn } from "@/lib/utils";
import { isHostedVideoEnabled } from "@/lib/video/providers";

function when(s: LiveStream) {
  return new Date(s.startedAt ?? s.scheduledAt).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StreamRow({ s }: { s: LiveStream }) {
  const live = s.status === "live";
  const replay = s.status === "ended" && s.recordingStatus === "ready";
  return (
    <Link
      href={`/live/${s.id}`}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-primary/40",
        live && "border-red-500/50 bg-red-500/5"
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          live ? "bg-red-600 text-white" : replay ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
        )}
      >
        {live ? <Radio className="h-5 w-5" /> : replay ? <PlayCircle className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{s.title}</span>
        <span className="block text-xs text-muted-foreground">
          {live ? "Live now" : when(s)}
          {s.audience === "leaders" ? " · Leaders only" : s.audience === "chapters" ? " · Selected chapters" : ""}
          {s.status === "ended" && (replay ? " · Replay" : s.recordingStatus === "processing" ? " · Replay coming" : "")}
        </span>
      </span>
    </Link>
  );
}

export default async function LivePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const canManage = can(profile, "manage_livestreams");
  const [streams, chapters] = await Promise.all([getLiveStreams(profile.zoneId), canManage ? getRecordChapters() : []]);

  const live = (streams ?? []).filter((s) => s.status === "live");
  const upcoming = (streams ?? []).filter((s) => s.status === "scheduled").reverse();
  const past = (streams ?? []).filter((s) => s.status === "ended" && (canManage || s.recordingStatus === "ready"));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live</h1>
          <p className="text-sm text-muted-foreground">Join a broadcast as it happens, or catch up on the replay.</p>
        </div>
        {canManage && isHostedVideoEnabled() && <StreamDialog chapters={chapters} />}
      </div>

      {canManage && !isHostedVideoEnabled() && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          Livestreaming uses the video host set up for lesson videos (Mux). Add its keys to the server&apos;s environment to start scheduling streams.
        </p>
      )}
      {streams === null && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          Livestreams aren&apos;t set up in the database yet — apply the latest migration.
        </p>
      )}

      {live.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600">Live now</h2>
          {live.map((s) => (
            <StreamRow key={s.id} s={s} />
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Coming up</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing scheduled right now.</p>
        ) : (
          upcoming.map((s) => <StreamRow key={s.id} s={s} />)
        )}
      </section>

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Replays</h2>
          {past.map((s) => (
            <StreamRow key={s.id} s={s} />
          ))}
        </section>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MuxPlayer from "@mux/mux-player-react/lazy";
import { CheckCircle2 } from "lucide-react";
import { reportLessonWatch } from "@/lib/actions/training-lessons";
import { WATCH_COMPLETE_RATIO, WATCH_REPORT_INTERVAL_SECONDS } from "@/lib/video/watch";
import type { PlaybackSource } from "@/lib/video/provider";
import { tenant } from "@/tenant";

// Plays a lesson's hosted video and reports how much of it was actually
// played (seeking ahead doesn't count). The lesson completes on the server
// once enough has been watched — there's no "mark complete" button.
export function HostedVideoPlayer({
  lessonId,
  title,
  source,
  durationSeconds,
  initialWatchedSeconds,
  initiallyCompleted,
  viewerId,
}: {
  lessonId: string;
  title: string;
  source: PlaybackSource;
  durationSeconds: number;
  initialWatchedSeconds: number;
  initiallyCompleted: boolean;
  viewerId: string;
}) {
  const router = useRouter();
  const [watched, setWatched] = useState(initialWatchedSeconds);
  const [completed, setCompleted] = useState(initiallyCompleted);
  const lastTime = useRef<number | null>(null);
  const unreported = useRef(0);
  const reporting = useRef(false);

  const flush = useCallback(async () => {
    if (completed || reporting.current || unreported.current < 1) return;
    const seconds = unreported.current;
    unreported.current = 0;
    reporting.current = true;
    const result = await reportLessonWatch(lessonId, seconds);
    reporting.current = false;
    if (!result.ok) return;
    setWatched(result.watchedSeconds);
    if (result.completed) {
      setCompleted(true);
      router.refresh(); // course sidebar + progress bar
    }
  }, [completed, lessonId, router]);

  useEffect(() => {
    const id = setInterval(flush, WATCH_REPORT_INTERVAL_SECONDS * 1000);
    return () => {
      clearInterval(id);
      void flush(); // leaving the page mid-interval
    };
  }, [flush]);

  function onTimeUpdate(e: Event) {
    const media = e.target as unknown as HTMLMediaElement;
    const t = media.currentTime;
    if (lastTime.current !== null && !media.paused && !media.seeking) {
      const delta = t - lastTime.current;
      // Normal playback advances a fraction of a second per event; anything
      // bigger (or negative) is a seek, which isn't watching.
      if (delta > 0 && delta < 3) unreported.current += delta;
    }
    lastTime.current = t;
  }

  const pct = durationSeconds > 0 ? Math.min(100, Math.round((watched / durationSeconds) * 100)) : 0;
  const target = Math.round(WATCH_COMPLETE_RATIO * 100);

  return (
    <div className="space-y-2">
      <div className="aspect-video overflow-hidden rounded-2xl bg-black">
        {/* One branch per host; each is a standard media element, so the
            same watch tracking works for all of them. */}
        {source.kind === "mux" && (
          <MuxPlayer
            playbackId={source.playbackId}
            tokens={source.tokens}
            streamType="on-demand"
            accentColor={tenant.chartPrimary}
            metadataVideoId={lessonId}
            metadataVideoTitle={title}
            metadataViewerUserId={viewerId}
            className="h-full w-full"
            onTimeUpdate={onTimeUpdate}
            onSeeking={() => (lastTime.current = null)}
            onPause={flush}
            onEnded={flush}
          />
        )}
      </div>
      {completed ? (
        <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Watched — lesson complete
        </p>
      ) : (
        <div className="space-y-1">
          <div className="relative h-1 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            <div className="absolute -top-0.5 h-2 w-px bg-foreground/40" style={{ left: `${target}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {pct}% watched · the lesson completes at {target}%
          </p>
        </div>
      )}
    </div>
  );
}

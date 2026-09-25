// Watch-to-complete rules for hosted lesson video, shared by the player
// (client) and the server action that records progress.

// Fraction of a hosted video a member has to watch to complete the lesson.
// Also hard-coded in the guard_lesson_progress() trigger — keep in step.
export const WATCH_COMPLETE_RATIO = 0.9;

// How often the player reports watched time while playing.
export const WATCH_REPORT_INTERVAL_SECONDS = 15;

// "4:12", "1:02:09".
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

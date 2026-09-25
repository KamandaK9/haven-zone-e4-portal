// Consecutive-day streaks, computed from a plain list of 'YYYY-MM-DD' dates
// — no dedicated tracking table; a "day" is any date on which the member
// completed a lesson or passed a quiz (see getMemberAchievementStats). Pure
// and DB-free so it's easy to reason about and test.

export type Streak = { current: number; longest: number };

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

export function computeStreak(activeDates: string[], today = new Date().toISOString().slice(0, 10)): Streak {
  const dates = [...new Set(activeDates)].sort();
  if (dates.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    run = daysBetween(dates[i - 1], dates[i]) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  // A streak is only "current" if the most recent active day was today or
  // yesterday — otherwise it's lapsed, even though it still counts toward
  // `longest` as a lifetime achievement.
  const last = dates[dates.length - 1];
  const gap = daysBetween(last, today);
  if (gap > 1) return { current: 0, longest };

  let current = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) current++;
    else break;
  }
  return { current, longest };
}

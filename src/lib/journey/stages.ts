// The journey a newcomer takes, worked out from what's already recorded —
// nobody has to move anyone along by hand.
//
//   new → contacted → in a cell → Foundation School → member → worker
//
// The furthest step reached counts. A newcomer who's been confirmed is a
// member whatever else is true; "worker" means they serve (the Worker status
// or any department).

export const STAGES = [
  { key: "new", label: "New", hint: "Checked in, nobody has been in touch yet" },
  { key: "contacted", label: "Contacted", hint: "Welcomed or followed up" },
  { key: "cell", label: "In a cell", hint: "Placed in a cell" },
  { key: "course", label: "In Foundation School", hint: "Enrolled in a class group" },
  { key: "member", label: "Member", hint: "Confirmed as a member" },
  { key: "worker", label: "Worker", hint: "Serving in a department" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

export type JourneyFacts = {
  isVisitor: boolean; // still a first-timer, not yet confirmed
  hasCell: boolean;
  enrolledInCourse: boolean;
  contacted: boolean; // a welcome sent, or a follow-up recorded
  serves: boolean; // Worker status, or in a department
};

export function stageOf(f: JourneyFacts): StageKey {
  if (!f.isVisitor) return f.serves ? "worker" : "member";
  if (f.enrolledInCourse) return "course";
  if (f.hasCell) return "cell";
  if (f.contacted) return "contacted";
  return "new";
}

// How long someone can sit at a step before they're flagged as stuck. Only
// the early steps: after that, they're on their way.
const STUCK_AFTER_DAYS: Partial<Record<StageKey, number>> = { new: 7, contacted: 21, cell: 35 };

export function isStuck(stage: StageKey, daysSinceJoin: number): boolean {
  const limit = STUCK_AFTER_DAYS[stage];
  return limit !== undefined && daysSinceJoin > limit;
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.round((Date.parse(`${toIso}T12:00:00Z`) - Date.parse(`${fromIso}T12:00:00Z`)) / 86_400_000));
}

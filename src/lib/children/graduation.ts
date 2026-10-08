// Moving up from children's church. Nobody's age is stored (only their
// birthday), so graduation is approximate: the head sets a month, and the
// screen shows who is due soon or overdue.

export type AgeGroupDef = { key: string; label: string; minAge?: number; maxAge?: number };

// The group a child moves into: the one that starts next after theirs.
export function nextAgeGroup(groups: readonly AgeGroupDef[], current: string): AgeGroupDef | undefined {
  const sorted = [...groups].sort((a, b) => (a.minAge ?? 0) - (b.minAge ?? 0));
  const i = sorted.findIndex((g) => g.key === current);
  return i >= 0 ? sorted[i + 1] : undefined;
}

export type GraduationState = "none" | "overdue" | "soon" | "later";

// `soon` is this month or the next two. Months compare as YYYY-MM.
export function graduationState(expected: string | null | undefined, today: string): GraduationState {
  if (!expected) return "none";
  const month = expected.slice(0, 7);
  const now = today.slice(0, 7);
  if (month < now) return "overdue";
  const [y, m] = now.split("-").map(Number);
  const limit = new Date(Date.UTC(y, m - 1 + 2, 1)).toISOString().slice(0, 7);
  return month <= limit ? "soon" : "later";
}

export function monthLabel(expected: string): string {
  return new Date(`${expected.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" });
}

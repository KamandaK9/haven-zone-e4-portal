// The four kinds of giving the zonal financier reports on. Stored as the
// `id` in giving_entries.category; entries recorded before categories
// existed have no category and only count toward "all".
export const GIVING_CATEGORIES = [
  { id: "pco", label: "PCO" },
  { id: "dues", label: "Dues" },
  { id: "special_project", label: "Special Project" },
  { id: "meta", label: "META" },
] as const;

export type GivingCategory = (typeof GIVING_CATEGORIES)[number]["id"];
export type GivingFilter = GivingCategory | "all";

export const GIVING_FILTER_OPTIONS: { id: GivingFilter; label: string }[] = [
  { id: "all", label: "All giving" },
  ...GIVING_CATEGORIES,
];

export function isGivingCategory(value: unknown): value is GivingCategory {
  return GIVING_CATEGORIES.some((c) => c.id === value);
}

export function parseGivingFilter(value: string | string[] | undefined): GivingFilter {
  const v = Array.isArray(value) ? value[0] : value;
  return isGivingCategory(v) ? v : "all";
}

export function givingFilterLabel(filter: GivingFilter): string {
  return GIVING_FILTER_OPTIONS.find((o) => o.id === filter)!.label;
}

// Spreadsheet cells are free text — accept the spellings a financier would
// plausibly type ("Special Projects", "special-project", "META", ...).
export function categoryFromText(raw: string | undefined): GivingCategory | undefined {
  const t = (raw ?? "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
  if (t === "pco") return "pco";
  if (t === "dues" || t === "due") return "dues";
  if (t === "special project" || t === "special projects" || t === "special") return "special_project";
  if (t === "meta") return "meta";
  return undefined;
}

// A member can have several entries in one month (one per category); charts
// plot a single point per month.
export function sumByMonth<T extends { month: string; amount: number }>(points: T[]): { month: string; amount: number }[] {
  const byMonth = new Map<string, number>();
  for (const p of points) byMonth.set(p.month, (byMonth.get(p.month) ?? 0) + p.amount);
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount }));
}

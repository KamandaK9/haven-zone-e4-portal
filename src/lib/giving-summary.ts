import { GIVING_CATEGORIES, type GivingCategory } from "@/lib/giving";

// One member's contributions, summarised for their profile: lifetime totals
// by giving type, year by year, and whether monthly dues are up to date.
// Pure — amounts are USD as stored; callers format them.

export type CategoryKey = GivingCategory | "uncategorised";

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  ...(Object.fromEntries(GIVING_CATEGORIES.map((c) => [c.id, c.label])) as Record<GivingCategory, string>),
  uncategorised: "Other",
};

// Display order: the giving types as configured, then anything untyped.
export const CATEGORY_ORDER: CategoryKey[] = [...GIVING_CATEGORIES.map((c) => c.id), "uncategorised"];

export type YearSummary = {
  year: number;
  total: number;
  byCategory: Record<CategoryKey, number>;
  // Change against the previous calendar year as a fraction (0.25 = +25%) —
  // for the year in progress, against the same months of last year, so a
  // part-year isn't compared with a whole one. Null when there's nothing to
  // compare with.
  change: number | null;
};

export type DuesStatus = {
  year: number;
  // Months of `year` that have passed (from January, or from the member's
  // first gift if that was later), as "YYYY-MM".
  dueMonths: string[];
  missedMonths: string[];
  currentMonth: string;
  currentMonthPaid: boolean;
  lastPaidMonth: string | null;
};

export type ContributionSummary = {
  total: number;
  byCategory: Record<CategoryKey, number>;
  // Newest first.
  years: YearSummary[];
  dues: DuesStatus;
};

const emptyByCategory = (): Record<CategoryKey, number> =>
  Object.fromEntries(CATEGORY_ORDER.map((k) => [k, 0])) as Record<CategoryKey, number>;

const monthKey = (year: number, monthIndex: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

export function summariseContributions(
  giving: readonly { month: string; amount: number; category?: GivingCategory }[],
  today: Date = new Date()
): ContributionSummary {
  const thisYear = today.getFullYear();
  const sameMonthLastYear = monthKey(thisYear - 1, today.getMonth());
  let lastYearToDate = 0;
  const byCategory = emptyByCategory();
  const byYear = new Map<number, Record<CategoryKey, number>>();
  let total = 0;

  for (const g of giving) {
    const year = Number(g.month.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const key: CategoryKey = g.category ?? "uncategorised";
    total += g.amount;
    byCategory[key] += g.amount;
    const row = byYear.get(year) ?? emptyByCategory();
    row[key] += g.amount;
    byYear.set(year, row);
    if (year === thisYear - 1 && g.month <= sameMonthLastYear) lastYearToDate += g.amount;
  }

  const sum = (r: Record<CategoryKey, number>) => CATEGORY_ORDER.reduce((s, k) => s + r[k], 0);
  const years: YearSummary[] = [...byYear.keys()]
    .sort((a, b) => b - a)
    .map((year) => {
      const yearTotal = sum(byYear.get(year)!);
      const previous = byYear.get(year - 1);
      const previousTotal = year === thisYear ? lastYearToDate : previous ? sum(previous) : 0;
      return {
        year,
        total: yearTotal,
        byCategory: byYear.get(year)!,
        change: previousTotal > 0 ? (yearTotal - previousTotal) / previousTotal : null,
      };
    });

  // Dues: every month of this year that has passed should have a dues
  // entry. Someone who joined (first gave) mid-year owes from then on.
  const year = thisYear;
  const currentMonth = monthKey(year, today.getMonth());
  const paid = new Set(giving.filter((g) => g.category === "dues" && g.amount > 0).map((g) => g.month));
  const firstMonth = giving.map((g) => g.month).sort()[0];
  const startIndex = firstMonth && firstMonth.startsWith(String(year)) ? Number(firstMonth.slice(5, 7)) - 1 : 0;
  const dueMonths: string[] = [];
  for (let m = startIndex; m < today.getMonth(); m++) dueMonths.push(monthKey(year, m));

  return {
    total,
    byCategory,
    years,
    dues: {
      year,
      dueMonths,
      missedMonths: dueMonths.filter((m) => !paid.has(m)),
      currentMonth,
      currentMonthPaid: paid.has(currentMonth),
      lastPaidMonth: [...paid].sort().at(-1) ?? null,
    },
  };
}

// "2026-03" → "Mar".
export function shortMonth(month: string): string {
  return new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).toLocaleString("en-US", { month: "short" });
}

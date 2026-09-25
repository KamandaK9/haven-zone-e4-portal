import type { ChapterRung, HandbookRules, MemberRung, ZoneRung } from "./types";

// Pure placement logic for the handbook's category ladders. All amounts are
// USD (how giving is stored); rungs are ordered best → worst.

export type Standing = { amount: number; members: number; chapters?: number };

export type Placement<R> = {
  // Highest rung whose every minimum is met; null = below the bottom rung.
  rung: R | null;
  index: number;
  // The rung above — what to aim for next; null when already at the top.
  next: R | null;
  // Shortfall against `next`, per criterion (0 = already met).
  gap: { amount: number; members: number; chapters: number } | null;
};

function meets(rung: ChapterRung | ZoneRung, s: Standing): boolean {
  return (
    s.amount >= rung.minAmount &&
    s.members >= rung.minMembers &&
    (!("minChapters" in rung) || (s.chapters ?? 0) >= rung.minChapters)
  );
}

function place<R extends ChapterRung | ZoneRung>(rungs: R[], s: Standing): Placement<R> {
  const index = rungs.findIndex((r) => meets(r, s));
  const next = index === -1 ? (rungs[rungs.length - 1] ?? null) : index > 0 ? rungs[index - 1] : null;
  return {
    rung: index === -1 ? null : rungs[index],
    index,
    next,
    gap: next
      ? {
          amount: Math.max(0, next.minAmount - s.amount),
          members: Math.max(0, next.minMembers - s.members),
          chapters: "minChapters" in next ? Math.max(0, next.minChapters - (s.chapters ?? 0)) : 0,
        }
      : null,
  };
}

export function categoriseChapter(rules: Pick<HandbookRules, "chapter">, s: Standing): Placement<ChapterRung> {
  return place(rules.chapter, s);
}

export function categoriseZone(rules: Pick<HandbookRules, "zone">, s: Standing): Placement<ZoneRung> {
  return place(rules.zone, s);
}

// "2025-10" → 2025. Sums any {month, amount} rows into per-year totals.
export function totalsByYear(points: readonly { month: string; amount: number }[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of points) {
    const year = Number(p.month.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    out.set(year, (out.get(year) ?? 0) + p.amount);
  }
  return out;
}

// Index of the best rung an amount qualifies for on its own. The bottom rung
// is expected to start at 0; if it doesn't, amounts below it land on it anyway.
export function tierIndexForAmount(rungs: readonly MemberRung[], amount: number): number {
  const i = rungs.findIndex((r) => amount >= r.minAmount);
  return i === -1 ? rungs.length - 1 : i;
}

// A member's tier in `year`, applying the SOP's year-on-year rules from their
// first year of giving:
//  - giving more than the previous year → ranked upward (to what the amount
//    qualifies for, never below the tier already held);
//  - giving equal to or less than the previous year → tier is kept;
//  - giving less than *both* of the previous two years → ranked downward, to
//    what the amount qualifies for.
// Years with no giving count as 0. Returns an index into rungs (0 = best).
export function memberTierIndex(rungs: readonly MemberRung[], byYear: ReadonlyMap<number, number>, year: number): number {
  const years = [...byYear.keys()].filter((y) => y <= year);
  if (years.length === 0) return tierIndexForAmount(rungs, 0);
  const first = Math.min(...years);
  const amt = (y: number) => byYear.get(y) ?? 0;

  let tier = tierIndexForAmount(rungs, amt(first));
  for (let y = first + 1; y <= year; y++) {
    const a = amt(y);
    const qualifies = tierIndexForAmount(rungs, a);
    if (a > amt(y - 1)) tier = Math.min(tier, qualifies);
    else if (y - 2 >= first && a < amt(y - 1) && a < amt(y - 2)) tier = Math.max(tier, qualifies);
  }
  return tier;
}

// What it takes to reach the next tier up in `year`: at least the next rung's
// floor, and (since only an increase ranks a member upward) more than last
// year's total. Null at the top rung.
export function memberTierGap(
  rungs: readonly MemberRung[],
  byYear: ReadonlyMap<number, number>,
  year: number
): { next: MemberRung; amount: number } | null {
  const index = memberTierIndex(rungs, byYear, year);
  if (index === 0) return null;
  const next = rungs[index - 1];
  const current = byYear.get(year) ?? 0;
  const previous = byYear.get(year - 1) ?? 0;
  const target = Math.max(next.minAmount, previous + 0.01);
  return { next, amount: Math.max(0, Math.ceil(target - current)) };
}

// Ids that earn a rank-based tier (e.g. Platinum: top 3 givers for 3
// consecutive years ending in `year`). Only meaningful over everyone in the
// org, so callers must pass the full population.
export function rankTierIds(
  people: readonly { id: string; byYear: ReadonlyMap<number, number> }[],
  year: number,
  topN: number,
  years: number
): Set<string> {
  const topIn = (y: number) =>
    people
      .map((p) => ({ id: p.id, amount: p.byYear.get(y) ?? 0 }))
      .filter((p) => p.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, topN)
      .map((p) => p.id);
  let qualifying = new Set(topIn(year));
  for (let y = year - 1; y > year - years; y--) {
    const top = new Set(topIn(y));
    qualifying = new Set([...qualifying].filter((id) => top.has(id)));
  }
  return qualifying;
}

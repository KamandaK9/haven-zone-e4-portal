import { memberTierGap, memberTierIndex, totalsByYear } from "./categorise";
import type { HandbookRules, MemberRung } from "./types";

// One member's card colour for their profile. The card is earned on a
// concluding year's giving, so it's based on last year; this year's total
// so far shows what the next card needs. (A rank-based tier, e.g. top 3
// partners, needs the whole zone and is shown on the Handbook instead.)
export type MemberStanding = {
  tier: MemberRung;
  basisYear: number;
  basisAmount: number;
  thisYear: { year: number; amount: number; gap: { next: MemberRung; amount: number } | null };
};

export function memberStanding(
  rules: HandbookRules,
  giving: readonly { month: string; amount: number }[],
  today: Date = new Date()
): MemberStanding | null {
  const rungs = rules.member.rungs;
  if (rungs.length === 0) return null;
  const byYear = totalsByYear(giving);
  const currentYear = today.getFullYear();
  const basisYear = currentYear - 1;
  return {
    tier: rungs[memberTierIndex(rungs, byYear, basisYear)],
    basisYear,
    basisAmount: byYear.get(basisYear) ?? 0,
    thisYear: {
      year: currentYear,
      amount: byYear.get(currentYear) ?? 0,
      gap: memberTierGap(rungs, byYear, currentYear),
    },
  };
}

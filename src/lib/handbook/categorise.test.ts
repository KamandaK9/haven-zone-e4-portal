import { describe, expect, it } from "vitest";
import {
  categoriseChapter,
  categoriseZone,
  memberTierGap,
  memberTierIndex,
  rankTierIds,
  tierIndexForAmount,
  totalsByYear,
} from "./categorise";
import type { HandbookRules, MemberRung } from "./types";

// Fixtures mirror the shape of real rules without depending on any tenant.
const rules: Pick<HandbookRules, "chapter" | "zone"> = {
  chapter: [
    { code: "A", label: "A", minAmount: 375_100, minMembers: 121 },
    { code: "B", label: "B", minAmount: 175_100, minMembers: 100 },
    { code: "C", label: "C", minAmount: 85_100, minMembers: 60 },
  ],
  zone: [
    { code: "A", label: "A", minAmount: 2_500_000, minChapters: 16, minMembers: 201 },
    { code: "C", label: "C", minAmount: 1_000_000, minChapters: 10, minMembers: 150 },
    { code: "PRECAT", label: "PRECAT", minAmount: 0, minChapters: 0, minMembers: 0 },
  ],
};

const tiers: MemberRung[] = [
  { code: "gold", label: "Gold", minAmount: 80_000, color: "" },
  { code: "silver", label: "Silver", minAmount: 35_000, color: "" },
  { code: "bronze", label: "Bronze", minAmount: 15_000, color: "" },
  { code: "purple", label: "Purple", minAmount: 4_000, color: "" },
  { code: "blue", label: "Blue", minAmount: 0, color: "" },
];
const GOLD = 0, SILVER = 1, BRONZE = 2, PURPLE = 3, BLUE = 4;
const years = (entries: Record<number, number>) => new Map(Object.entries(entries).map(([y, a]) => [Number(y), a]));

describe("categoriseChapter", () => {
  it("places on the highest rung where both amount and members are met", () => {
    expect(categoriseChapter(rules, { amount: 400_000, members: 130 }).rung?.code).toBe("A");
    // Money for A but only B's membership.
    expect(categoriseChapter(rules, { amount: 400_000, members: 110 }).rung?.code).toBe("B");
  });

  it("treats rung floors as inclusive", () => {
    expect(categoriseChapter(rules, { amount: 375_100, members: 121 }).rung?.code).toBe("A");
    expect(categoriseChapter(rules, { amount: 375_000, members: 121 }).rung?.code).toBe("B");
  });

  it("reports the gap to the next rung per criterion", () => {
    const p = categoriseChapter(rules, { amount: 100_000, members: 105 });
    expect(p.rung?.code).toBe("C");
    expect(p.next?.code).toBe("B");
    expect(p.gap).toEqual({ amount: 75_100, members: 0, chapters: 0 });
  });

  it("returns no rung below the bottom, aiming at the bottom rung", () => {
    const p = categoriseChapter(rules, { amount: 1_000, members: 3 });
    expect(p.rung).toBeNull();
    expect(p.next?.code).toBe("C");
  });

  it("has no next rung at the top", () => {
    const p = categoriseChapter(rules, { amount: 1_000_000, members: 500 });
    expect(p.next).toBeNull();
    expect(p.gap).toBeNull();
  });
});

describe("categoriseZone", () => {
  it("requires the chapter count too", () => {
    expect(categoriseZone(rules, { amount: 3_000_000, members: 300, chapters: 12 }).rung?.code).toBe("C");
    expect(categoriseZone(rules, { amount: 3_000_000, members: 300, chapters: 16 }).rung?.code).toBe("A");
  });

  it("falls back to a zero-floor rung", () => {
    expect(categoriseZone(rules, { amount: 0, members: 0, chapters: 0 }).rung?.code).toBe("PRECAT");
  });
});

describe("totalsByYear", () => {
  it("sums months into calendar years", () => {
    const t = totalsByYear([
      { month: "2024-12", amount: 10 },
      { month: "2025-01", amount: 5 },
      { month: "2025-06", amount: 7 },
    ]);
    expect(t.get(2024)).toBe(10);
    expect(t.get(2025)).toBe(12);
  });
});

describe("memberTierIndex", () => {
  it("uses the amount alone in the first year", () => {
    expect(memberTierIndex(tiers, years({ 2023: 40_000 }), 2023)).toBe(SILVER);
    expect(tierIndexForAmount(tiers, 3_999)).toBe(BLUE);
    expect(tierIndexForAmount(tiers, 4_000)).toBe(PURPLE);
  });

  it("with no giving at all is the bottom tier", () => {
    expect(memberTierIndex(tiers, years({}), 2025)).toBe(BLUE);
  });

  it("ranks upward when giving increases", () => {
    expect(memberTierIndex(tiers, years({ 2023: 5_000, 2024: 20_000 }), 2024)).toBe(BRONZE);
  });

  it("keeps the tier when giving is equal or lower than last year", () => {
    expect(memberTierIndex(tiers, years({ 2023: 40_000, 2024: 20_000 }), 2024)).toBe(SILVER);
    expect(memberTierIndex(tiers, years({ 2023: 40_000, 2024: 40_000 }), 2024)).toBe(SILVER);
  });

  it("does not drop a held tier when an increase still qualifies lower", () => {
    // Silver in 2023, dips (kept), then rises — but only to a Bronze amount.
    expect(memberTierIndex(tiers, years({ 2023: 40_000, 2024: 10_000, 2025: 20_000 }), 2025)).toBe(SILVER);
  });

  it("ranks downward when a year is below both previous years", () => {
    expect(memberTierIndex(tiers, years({ 2023: 90_000, 2024: 50_000, 2025: 20_000 }), 2025)).toBe(BRONZE);
  });

  it("counts a missing year as zero", () => {
    // 2024 absent → 0; 2025 is below 2023 but above 2024 → kept, not downgraded.
    expect(memberTierIndex(tiers, years({ 2023: 90_000, 2025: 20_000 }), 2025)).toBe(GOLD);
  });

  it("ignores years after the one asked about", () => {
    expect(memberTierIndex(tiers, years({ 2023: 5_000, 2024: 90_000 }), 2023)).toBe(PURPLE);
  });
});

describe("memberTierGap", () => {
  it("needs the next floor and more than last year", () => {
    expect(memberTierGap(tiers, years({ 2025: 10_000 }), 2025)).toEqual({ next: tiers[BRONZE], amount: 5_000 });
    // Held Silver from 2024's 60k; Gold needs 80k (above last year's 60k anyway).
    expect(memberTierGap(tiers, years({ 2024: 60_000, 2025: 30_000 }), 2025)?.amount).toBe(50_000);
  });

  it("is null at the top", () => {
    expect(memberTierGap(tiers, years({ 2025: 100_000 }), 2025)).toBeNull();
  });
});

describe("rankTierIds", () => {
  const person = (id: string, e: Record<number, number>) => ({ id, byYear: years(e) });

  it("keeps only people in the top N every year of the window", () => {
    const people = [
      person("a", { 2023: 100, 2024: 100, 2025: 100 }),
      person("b", { 2023: 90, 2024: 5, 2025: 90 }),
      person("c", { 2023: 80, 2024: 80, 2025: 80 }),
    ];
    expect([...rankTierIds(people, 2025, 2, 3)].sort()).toEqual(["a"]);
    expect([...rankTierIds(people, 2025, 3, 3)].sort()).toEqual(["a", "b", "c"]);
  });

  it("ignores people with no giving in a year", () => {
    expect(rankTierIds([person("a", { 2025: 0 })], 2025, 3, 1).size).toBe(0);
  });
});

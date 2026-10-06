import { describe, expect, it } from "vitest";
import { shortMonth, summariseContributions } from "./giving-summary";

const today = new Date(2026, 4, 20); // 20 May 2026

describe("summariseContributions", () => {
  const giving = [
    { month: "2025-03", amount: 100, category: "pco" as const },
    { month: "2025-06", amount: 50, category: "dues" as const },
    { month: "2026-01", amount: 40, category: "dues" as const },
    { month: "2026-03", amount: 40, category: "dues" as const },
    { month: "2026-04", amount: 200, category: "special_project" as const },
    { month: "2026-04", amount: 10 },
  ];

  it("totals by giving type, with untyped gifts under Other", () => {
    const s = summariseContributions(giving, today);
    expect(s.total).toBe(440);
    expect(s.byCategory).toMatchObject({ pco: 100, dues: 130, special_project: 200, meta: 0, uncategorised: 10 });
  });

  it("lists years newest first with change against the year before", () => {
    const s = summariseContributions(giving, today);
    expect(s.years.map((y) => [y.year, y.total])).toEqual([
      [2026, 290],
      [2025, 150],
    ]);
    // 2026 so far (to May) against Jan–May 2025, which had only the March PCO.
    expect(s.years[0].change).toBeCloseTo(290 / 100 - 1);
    expect(s.years[1].change).toBeNull();
  });

  it("finds dues months missed so far this year", () => {
    const { dues } = summariseContributions(giving, today);
    expect(dues.dueMonths).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(dues.missedMonths).toEqual(["2026-02", "2026-04"]);
    expect(dues.currentMonth).toBe("2026-05");
    expect(dues.currentMonthPaid).toBe(false);
    expect(dues.lastPaidMonth).toBe("2026-03");
  });

  it("only counts dues from a new member's first month", () => {
    const { dues } = summariseContributions([{ month: "2026-03", amount: 40, category: "dues" }], today);
    expect(dues.dueMonths).toEqual(["2026-03", "2026-04"]);
    expect(dues.missedMonths).toEqual(["2026-04"]);
  });

  it("handles someone with no giving", () => {
    const s = summariseContributions([], today);
    expect(s.total).toBe(0);
    expect(s.years).toEqual([]);
    expect(s.dues.missedMonths).toHaveLength(4);
    expect(s.dues.lastPaidMonth).toBeNull();
  });
});

describe("shortMonth", () => {
  it("names the month", () => {
    expect(shortMonth("2026-02")).toBe("Feb");
  });
});

describe("memberStanding", () => {
  it("bases the card on last year and the gap on this year", async () => {
    const { memberStanding } = await import("./handbook/member-standing");
    const rules = {
      yearLabel: "year",
      zone: [],
      chapter: [],
      governorship: [],
      member: {
        rankTier: null,
        rungs: [
          { code: "gold", label: "Gold", minAmount: 1000, color: "" },
          { code: "blue", label: "Blue", minAmount: 0, color: "" },
        ],
      },
    };
    const s = memberStanding(rules, [{ month: "2025-02", amount: 1200 }, { month: "2026-02", amount: 300 }], today)!;
    expect(s.tier.code).toBe("gold");
    expect(s.basisYear).toBe(2025);
    expect(s.thisYear.amount).toBe(300);
    expect(s.thisYear.gap).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { applyRuleOverrides, diffRuleOverrides, validateRules } from "./rules";
import type { HandbookRules } from "./types";

const defaults: HandbookRules = {
  yearLabel: "year",
  zone: [
    { code: "A", label: "Zone A", minAmount: 2_000, minChapters: 10, minMembers: 100 },
    { code: "B", label: "Zone B", minAmount: 0, minChapters: 0, minMembers: 0 },
  ],
  chapter: [
    { code: "A", label: "Chapter A", minAmount: 500, minMembers: 20 },
    { code: "B", label: "Chapter B", minAmount: 100, minMembers: 20 },
  ],
  member: {
    rankTier: null,
    rungs: [
      { code: "gold", label: "Gold", minAmount: 1_000, color: "#000" },
      { code: "blue", label: "Blue", minAmount: 0, color: "#000" },
    ],
  },
  governorship: [
    { title: "Governor", minAmount: 300, requirements: [] },
    { title: "Coordinator", minAmount: 50, requirements: [] },
  ],
};

describe("applyRuleOverrides", () => {
  it("returns the defaults untouched without overrides", () => {
    expect(applyRuleOverrides(defaults, null)).toBe(defaults);
  });

  it("replaces only the overridden numbers, keyed by code", () => {
    const rules = applyRuleOverrides(defaults, { chapter: { B: { minAmount: 150 } }, member: { gold: { minAmount: 2_000 } } });
    expect(rules.chapter[1]).toEqual({ code: "B", label: "Chapter B", minAmount: 150, minMembers: 20 });
    expect(rules.chapter[0]).toEqual(defaults.chapter[0]);
    expect(rules.member.rungs[0].minAmount).toBe(2_000);
  });

  it("ignores unknown codes and non-numeric values", () => {
    const rules = applyRuleOverrides(defaults, {
      chapter: { Z: { minAmount: 1 }, A: { minAmount: "lots" as unknown as number } },
    });
    expect(rules.chapter).toEqual(defaults.chapter);
  });
});

describe("diffRuleOverrides", () => {
  it("is null when nothing changed", () => {
    expect(diffRuleOverrides(defaults, structuredClone(defaults))).toBeNull();
  });

  it("round-trips through applyRuleOverrides", () => {
    const edited = structuredClone(defaults);
    edited.zone[0].minChapters = 12;
    edited.governorship[1].minAmount = 60;
    const diff = diffRuleOverrides(defaults, edited);
    expect(diff).toEqual({ zone: { A: { minChapters: 12 } }, governorship: { Coordinator: { minAmount: 60 } } });
    expect(applyRuleOverrides(defaults, diff)).toEqual(edited);
  });
});

describe("validateRules", () => {
  it("accepts sound rules", () => {
    expect(validateRules(defaults)).toBeNull();
  });

  it("rejects a ladder that isn't strictly descending in amount", () => {
    const edited = structuredClone(defaults);
    edited.chapter[1].minAmount = 500;
    expect(validateRules(edited)).toMatch(/Chapter A must need more giving than Chapter B/);
  });

  it("allows equal member counts but not a higher rung needing fewer", () => {
    const edited = structuredClone(defaults);
    edited.chapter[0].minMembers = 10;
    expect(validateRules(edited)).toMatch(/can't need fewer members/);
  });

  it("rejects negative or fractional values", () => {
    const edited = structuredClone(defaults);
    edited.member.rungs[1].minAmount = -1;
    expect(validateRules(edited)).toMatch(/whole number/);
    edited.member.rungs[1].minAmount = 0.5;
    expect(validateRules(edited)).toMatch(/whole number/);
  });
});

describe("the deployed tenant's default rules", () => {
  it("are valid", async () => {
    const { tenant } = await import("@/tenant");
    if (tenant.handbook) expect(validateRules(tenant.handbook.rules)).toBeNull();
  });
});

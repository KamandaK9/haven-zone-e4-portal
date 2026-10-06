import { describe, expect, it } from "vitest";
import { CAPABILITIES } from "./access";
import { ACCESS_PRESETS, ALL_CAPABILITIES } from "./access-presets";

describe("access presets", () => {
  it("ALL_CAPABILITIES matches the capability list", () => {
    expect([...ALL_CAPABILITIES].sort()).toEqual([...CAPABILITIES].sort());
  });

  for (const [key, preset] of Object.entries(ACCESS_PRESETS)) {
    describe(key, () => {
      const { positions, memberPositionKey, rootPositionKey, assistantPositionKey, portfolios } = preset.access;
      const keys = positions.map((p) => p.key);

      it("names positions that exist", () => {
        for (const k of [memberPositionKey, rootPositionKey, assistantPositionKey]) expect(keys).toContain(k);
      });

      it("has unique keys and only known capabilities", () => {
        expect(new Set(keys).size).toBe(keys.length);
        const known = new Set<string>(CAPABILITIES);
        for (const p of positions) {
          for (const c of p.baseCaps) expect(known.has(c)).toBe(true);
          for (const [portfolio, caps] of Object.entries(p.portfolioCaps ?? {})) {
            expect(portfolios.map((f) => f.key)).toContain(portfolio);
            for (const c of caps) expect(known.has(c)).toBe(true);
          }
        }
      });

      it("gives the root position every capability and members none", () => {
        expect([...positions.find((p) => p.key === rootPositionKey)!.baseCaps].sort()).toEqual([...CAPABILITIES].sort());
        const member = positions.find((p) => p.key === memberPositionKey)!;
        expect(member.baseCaps).toEqual([]);
        expect(member.loginRole).toBe("member");
        expect(Math.max(...positions.map((p) => p.rank))).toBe(member.rank);
      });
    });
  }
});

import { describe, expect, it } from "vitest";
import { EDITIONS, editionFor } from "./editions";
import { accessPreset } from "./access-presets";

describe("editions", () => {
  it("keep church-only areas out of Forge", () => {
    for (const churchOnly of ["giving", "attendance", "courses", "messaging"] as const) {
      expect(EDITIONS.cornerstone.modules).toContain(churchOnly);
      expect(EDITIONS.forge.modules).not.toContain(churchOnly);
    }
    expect(EDITIONS.forge.modules).toEqual(expect.arrayContaining(["records", "training", "ledger"]));
  });

  it("default to Cornerstone", () => {
    expect(editionFor(undefined).key).toBe("cornerstone");
    expect(editionFor("forge").name).toBe("Stratum Forge");
  });

  it("give Forge business statuses and roles", () => {
    expect(EDITIONS.forge.memberStatuses[0]).toBe("Staff");
    const business = accessPreset("business");
    expect(business.rootPositionKey).toBe("owner");
    // Everyone else keeps the database's default position key.
    expect(business.positions.find((p) => p.key === business.memberPositionKey)?.label).toBe("Staff");
    const ranks = business.positions.map((p) => p.rank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });
});

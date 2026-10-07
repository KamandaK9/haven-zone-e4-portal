import { describe, expect, it } from "vitest";
import { clusterCellNames } from "./cluster-cells";

describe("clusterCellNames", () => {
  it("groups spellings of one cell under its most-used spelling", () => {
    const result = clusterCellNames(["Kings & Pearls", "Kings & Pearls", "KINGS&PEARLS", "King & Pearls", "Swan", "Swan 2", "Swan Cell 3", "Swan3"]);
    expect(result.map((c) => [c.name, c.count, c.variants.length])).toEqual([
      ["Kings & Pearls", 4, 3],
      ["Swan", 1, 1],
      ["Swan 2", 1, 1],
      ["Swan 3", 2, 2],
    ]);
  });

  it("prefers normal capitalisation on a tie and drops a trailing 'Cell'", () => {
    expect(clusterCellNames(["HAVEN", "Haven"]).map((c) => c.name)).toEqual(["Haven"]);
    expect(clusterCellNames(["Platinum Cell"]).map((c) => c.name)).toEqual(["Platinum"]);
  });

  it("flags ministries, age groups and placeholders as probably not cells", () => {
    const likely = Object.fromEntries(
      clusterCellNames(["Youth Church", "Teens & Youth", "ADULT", "No yet", "y", "Auxano"]).map((c) => [c.name, c.likelyCell])
    );
    expect(likely).toEqual({ "Youth Church": false, "Teens & Youth": false, ADULT: false, "No yet": false, y: false, Auxano: true });
  });

  it("ignores blanks", () => {
    expect(clusterCellNames([undefined, "", "  "])).toEqual([]);
  });
});

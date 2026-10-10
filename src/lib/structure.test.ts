import { describe, expect, it } from "vitest";
import { chapterNameKey, groupBySubZone, holdersOf, leadershipTimeline, structureIssues, tenureLabel } from "./structure";
import type { Church, Member } from "@/lib/data/types";

const countries = [
  { id: "za", name: "South Africa", flag: "🇿🇦" },
  { id: "bw", name: "Botswana", flag: "🇧🇼" },
];
const subZones = [
  { id: "sz1", name: "Sub-zone 1" },
  { id: "sz2", name: "Sub-zone 2" },
  { id: "sz10", name: "Sub-zone 10" },
];
const church = (id: string, countryId: string, subZoneId?: string, extra: Partial<Church> = {}): Church => ({ id, name: id, countryId, subZoneId, ...extra });

describe("groupBySubZone", () => {
  const churches = [
    church("Sandton", "za", "sz1"),
    church("Gaborone", "bw", "sz2"),
    church("Francistown", "bw", "sz2"),
    church("Border town", "za", "sz2"),
    church("Office", "za", "sz1", { isOffice: true }),
    church("New plant", "bw"),
  ];

  it("puts sub-zones first, then countries, then chapters", () => {
    const groups = groupBySubZone(subZones, countries, churches);
    expect(groups.map((g) => g.subZone?.name ?? "none")).toEqual(["Sub-zone 1", "Sub-zone 2", "Sub-zone 10", "none"]);
    expect(groups[0].countries.map((c) => [c.country.name, c.churches.map((ch) => ch.name)])).toEqual([["South Africa", ["Sandton"]]]);
    // A sub-zone across a border: both countries, chapters sorted.
    expect(groups[1].countries.map((c) => [c.country.name, c.churches.map((ch) => ch.name)])).toEqual([
      ["Botswana", ["Francistown", "Gaborone"]],
      ["South Africa", ["Border town"]],
    ]);
    expect(groups[1].churchCount).toBe(3);
    expect(groups[3].countries[0].churches.map((c) => c.name)).toEqual(["New plant"]);
  });

  it("leaves out offices, and empty sub-zones when asked", () => {
    const groups = groupBySubZone(subZones, countries, churches, { includeEmpty: false });
    expect(groups.map((g) => g.subZone?.id ?? null)).toEqual(["sz1", "sz2", null]);
    expect(groups[0].churchCount).toBe(1);
  });
});

describe("leaders", () => {
  it("finds who holds a position, within some chapters", () => {
    const members = [
      { id: "a", position: "sub_zone_governor", churchId: "Sandton" },
      { id: "b", position: "governor", churchId: "Gaborone" },
      { id: "c", position: "governor", churchId: "Sandton" },
    ] as Member[];
    expect(holdersOf(members, "governor").map((m) => m.id)).toEqual(["b", "c"]);
    expect(holdersOf(members, "governor", new Set(["Sandton"])).map((m) => m.id)).toEqual(["c"]);
    expect(holdersOf(members, undefined)).toEqual([]);
  });

  it("orders the timeline current-first and labels each term", () => {
    const timeline = leadershipTimeline([
      { id: "1", name: "First", endedOn: "2014-12-31", manual: true },
      { id: "3", name: "Now", startedOn: "2021-06-01", manual: false },
      { id: "2", name: "Second", startedOn: "2015-03-01", endedOn: "2021-05-31", manual: true },
    ]);
    expect(timeline.map((e) => e.name)).toEqual(["Now", "Second", "First"]);
    expect(timeline.map(tenureLabel)).toEqual(["Since Jun 2021", "Mar 2015 – May 2021", "Until Dec 2014"]);
    expect(tenureLabel({})).toBe("Dates not recorded");
  });
});

describe("structureIssues", () => {
  it("matches names that are probably the same location", () => {
    expect(chapterNameKey("Grace Victoria Falls 1", "Grace")).toBe(chapterNameKey("Victoria Falls"));
    expect(chapterNameKey("Grace Harare CBD2", "Grace")).toBe(chapterNameKey("Harare CBD 2"));
    expect(chapterNameKey("Harare CBD 1")).toBe(chapterNameKey("Grace Harare CBD", "Grace"));
    expect(chapterNameKey("Harare CBD 2")).not.toBe(chapterNameKey("Harare CBD"));
  });

  it("doesn't take sister locations for twins", () => {
    const sisters = [church("Grace Gaborone 1A", "bw", "sz2"), church("Grace Gaborone 1B", "bw", "sz2"), church("Glen Norah A", "bw", "sz2"), church("Glen Norah B", "bw", "sz2")];
    const issues = structureIssues(sisters, countries, () => 1, { orgWord: "Grace" });
    expect([...issues.values()].flat()).toEqual([]);
  });

  it("flags the odd country out, likely twins, and missing sub-zones and leaders", () => {
    const zw = { id: "zw", name: "Zimbabwe", flag: "" };
    const churches = [
      church("Grace Sandton", "za", "sz1"),
      church("Grace Soweto", "za", "sz1"),
      church("Tswelopele", "zw", "sz1"),
      church("Glen View", "zw", "sz3"),
      church("Grace Glen View 1", "zw", "sz3"),
      church("Grace Glen Norah A", "zw", "sz3"),
      church("Grace Marondera", "zw"),
    ];
    const issues = structureIssues(churches, [...countries, zw], (id) => (id === "Grace Sandton" ? 1 : 0), { orgWord: "Grace" });
    const kinds = (id: string) => issues.get(id)!.map((i) => i.kind).sort();
    expect(issues.get("Tswelopele")).toContainEqual({ kind: "country", usual: "South Africa" });
    expect(kinds("Grace Sandton")).toEqual([]);
    expect(issues.get("Glen View")).toContainEqual({ kind: "duplicate", ofId: "Grace Glen View 1", ofName: "Grace Glen View 1" });
    expect(kinds("Grace Glen Norah A")).toEqual(["no_leader"]); // not a twin of Glen View
    expect(kinds("Grace Marondera")).toEqual(["no_leader", "no_sub_zone"]);
  });
});

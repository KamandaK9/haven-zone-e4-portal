import { describe, expect, it } from "vitest";
import { buildCellTree, totalMembers } from "./cells";
import { chequeGaps, nextChequeNumber } from "./cheques";
import { checkRecordFile, formatBytes } from "./files";

describe("chequeGaps", () => {
  it("lists numbers missing between the lowest and highest", () => {
    expect(chequeGaps(["101", "102", "105"])).toEqual({ missing: ["103", "104"], more: 0 });
  });

  it("keeps the cheque book's zero-padding", () => {
    expect(chequeGaps(["000098", "000101"]).missing).toEqual(["000099", "000100"]);
  });

  it("ignores duplicates, order and numbers that aren't plain digits", () => {
    expect(chequeGaps(["7", "5", "5", "CHQ-6"]).missing).toEqual(["6"]);
  });

  it("summarises very large holes", () => {
    const g = chequeGaps(["1", "100"], 5);
    expect(g.missing).toHaveLength(5);
    expect(g.more).toBe(93);
  });

  it("has nothing to compare with fewer than two numbers", () => {
    expect(chequeGaps(["12"])).toEqual({ missing: [], more: 0 });
  });
});

describe("nextChequeNumber", () => {
  it("is one past the highest, padded", () => {
    expect(nextChequeNumber(["000123", "000121"])).toBe("000124");
    expect(nextChequeNumber([])).toBe("");
  });
});

describe("buildCellTree", () => {
  const cells = [
    { id: "s2", parentId: null, name: "Senior cell 10" },
    { id: "s1", parentId: null, name: "Senior cell 2" },
    { id: "c1", parentId: "s1", name: "Cell B" },
    { id: "c2", parentId: "s1", name: "Cell A" },
    { id: "orphan", parentId: "gone", name: "Lost cell" },
  ];

  it("nests cells under their senior cell, sorted naturally", () => {
    const tree = buildCellTree(cells, []);
    expect(tree.map((n) => n.name)).toEqual(["Lost cell", "Senior cell 2", "Senior cell 10"]);
    expect(tree[1].children.map((c) => c.name)).toEqual(["Cell A", "Cell B"]);
  });

  it("counts members per cell and per group", () => {
    const tree = buildCellTree(cells, ["c1", "c1", "c2", "s1", null, undefined]);
    const s1 = tree.find((n) => n.id === "s1")!;
    expect(s1.memberCount).toBe(1);
    expect(totalMembers(s1)).toBe(4);
  });
});

describe("checkRecordFile", () => {
  it("accepts scans and office files within the limit", () => {
    expect(checkRecordFile("application/pdf", 1000)).toBeNull();
    expect(checkRecordFile("image/heic", 1000)).toBeNull();
  });

  it("rejects other types, empty and oversized files", () => {
    expect(checkRecordFile("application/zip", 1000)).toMatch(/PDF/);
    expect(checkRecordFile("application/pdf", 0)).toMatch(/empty/);
    expect(checkRecordFile("application/pdf", 26 * 1024 * 1024)).toMatch(/too large/);
  });

  it("formats sizes", () => {
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

import { describe, expect, it } from "vitest";
import { matchCell } from "./match-cell";

const cells = [
  { id: "kp", name: "Kings & Pearls" },
  { id: "hk", name: "Honourable Kings" },
  { id: "lu", name: "Luminary" },
  { id: "pl", name: "Platinum" },
  { id: "p3", name: "Platinum 3" },
  { id: "sw", name: "Swan" },
];
const match = (name: string) => matchCell(name, cells)?.id;

describe("matchCell", () => {
  it("ignores case, spacing, '&' vs 'and', and a trailing 'cell'", () => {
    expect(match("KINGS & PEARLS")).toBe("kp");
    expect(match("Kings&Pearls")).toBe("kp");
    expect(match("Kings and Pearls")).toBe("kp");
    expect(match("Luminary Cell")).toBe("lu");
    expect(match("Platinum3")).toBe("p3");
    expect(match("SWAN")).toBe("sw");
  });

  it("forgives small spelling slips", () => {
    expect(match("Honerable Kings")).toBe("hk");
    expect(match("Honarable Kings")).toBe("hk");
    expect(match("King & Pearls")).toBe("kp");
    expect(match("Lminary")).toBe("lu");
    expect(match("Plutinum")).toBe("pl");
  });

  it("leaves anything else unmatched", () => {
    expect(match("Youth Church")).toBeUndefined();
    expect(match("y")).toBeUndefined();
    expect(match("Swan 2")).toBeUndefined();
    expect(match("Kings")).toBeUndefined();
  });
});

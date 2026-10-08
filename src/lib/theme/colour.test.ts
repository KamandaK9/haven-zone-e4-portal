import { describe, expect, it } from "vitest";
import { adjustForContrast, bestForeground, contrast, fromOklch, normaliseHex, parseHex, toOklch, withLightness } from "./colour";

describe("hex", () => {
  it("reads and normalises", () => {
    expect(parseHex("#b8902a")).toEqual([184, 144, 42]);
    expect(normaliseHex("FA0")).toBe("#ffaa00");
    expect(normaliseHex("not a colour")).toBeNull();
    expect(normaliseHex("#12345")).toBeNull();
  });
});

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
  });
});

describe("oklch", () => {
  it("round-trips colours", () => {
    for (const hex of ["#b8902a", "#4f46e5", "#15803d", "#9f1239", "#101010", "#f5f5f5"]) {
      expect(contrast(fromOklch(toOklch(hex)), hex), hex).toBeLessThan(1.03); // the same colour back
    }
  });
  it("lightening raises luminance and keeps the hue", () => {
    const lighter = withLightness("#4f46e5", 0.8);
    expect(contrast(lighter, "#000000")).toBeGreaterThan(contrast("#4f46e5", "#000000"));
    expect(Math.abs(toOklch(lighter).h - toOklch("#4f46e5").h)).toBeLessThan(8);
  });
  it("never returns an invalid colour for extreme inputs", () => {
    expect(fromOklch({ l: 0.5, c: 0.5, h: 150 })).toMatch(/^#[0-9a-f]{6}$/);
    expect(contrast(fromOklch({ l: 1.2, c: 0.2, h: 20 }), "#ffffff")).toBeLessThan(1.05);
    expect(contrast(fromOklch({ l: -1, c: 0.2, h: 20 }), "#000000")).toBeLessThan(1.1);
  });
});

describe("adjustForContrast", () => {
  it("keeps a colour that already reads", () => {
    expect(adjustForContrast("#4f46e5", "#ffffff", 4.5)).toBe("#4f46e5");
  });
  it("darkens against a light background and lightens against a dark one", () => {
    const dark = adjustForContrast("#e0b040", "#ffffff", 4.5)!;
    expect(contrast(dark, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    const light = adjustForContrast("#4f46e5", "#1a1814", 4.5)!;
    expect(contrast(light, "#1a1814")).toBeGreaterThanOrEqual(4.5);
  });
  it("gives up when no shade of the colour can do it", () => {
    // Mid-grey on itself: even pure white only reaches ~3.9:1.
    expect(adjustForContrast("#808080", "#808080", 4.5)).toBeUndefined();
    expect(adjustForContrast("#ffffff", "#fefefe", 21)).toBeUndefined();
  });
});

it("picks readable text for a background", () => {
  expect(bestForeground("#1a1814")).toBe("#ffffff");
  expect(bestForeground("#f1e3b0")).toBe("#14110d");
  expect(contrast(bestForeground("#b8902a"), "#b8902a")).toBeGreaterThanOrEqual(4.5);
});

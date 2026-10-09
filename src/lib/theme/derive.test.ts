import { describe, expect, it } from "vitest";
import { PRESETS } from "./presets";
import { contrast } from "./colour";
import { deriveTheme, themeCss } from "./derive";
import { adviseTheme } from "./advice";

describe("every preset is readable, in light and dark", () => {
  for (const p of PRESETS) {
    it(p.label, () => {
      const t = deriveTheme(p);
      expect(contrast(t.light.sidebar, t.light["sidebar-foreground"]), "words on the nav bar").toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.light["sidebar-primary"], t.light.sidebar), "highlight on the nav bar").toBeGreaterThanOrEqual(3);
      expect(contrast(t.light["sidebar-primary"], t.light["sidebar-primary-foreground"]), "text on the highlight").toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.light.primary, t.light["primary-foreground"]), "button label").toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.dark.primary, "#14130f"), "brand colour on a dark page").toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.dark.sidebar, t.dark["sidebar-foreground"]), "words on the dark nav bar").toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.dark["sidebar-primary"], t.dark.sidebar), "highlight on the dark nav bar").toBeGreaterThanOrEqual(3);
      // No preset needs a warning that says it's hard to see.
      expect(adviseTheme(p).filter((a) => a.level === "poor")).toEqual([]);
    });
  }
});

describe("themeCss", () => {
  it("writes light and dark blocks of hex values only", () => {
    const css = themeCss(deriveTheme(PRESETS[0]));
    expect(css.startsWith("html:root{")).toBe(true);
    expect(css).toContain("html.dark{");
    expect(css).toMatch(/--primary:#[0-9a-f]{6};/);
    expect(css).not.toMatch(/[<>"]/);
  });
  it("copes with junk input by falling back, never producing broken CSS", () => {
    const css = themeCss(deriveTheme({ primary: "red; } body { display:none", sidebar: "x" }));
    expect(css).not.toContain("display");
    expect(css).toMatch(/--primary:#[0-9a-f]{6};/);
  });
});

describe("adviseTheme", () => {
  it("warns about a colour too light for white pages and offers a deeper one that works", () => {
    const advice = adviseTheme({ primary: "#ffe066", sidebar: "#1a1814" });
    const links = advice.find((a) => a.area === "Links and icons on white pages")!;
    expect(links.level).toBe("poor");
    expect(contrast(links.fix!.hex, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(links.fix!.field).toBe("primary");
  });
  it("warns about a mid-tone nav bar", () => {
    const nav = adviseTheme({ primary: "#4f46e5", sidebar: "#777777" }).find((a) => a.area === "Nav bar")!;
    expect(nav.level).toBe("poor");
    expect(nav.fix?.field).toBe("sidebar");
    expect(contrast(nav.fix!.hex, "#ffffff")).toBeGreaterThanOrEqual(7);
  });
  it("explains when a dark brand colour is lightened on the nav bar", () => {
    const h = adviseTheme({ primary: "#4f46e5", sidebar: "#1f1d5c" }).find((a) => a.area === "Highlights on the nav bar")!;
    expect(h.level).toBe("good");
    expect(h.message).toMatch(/lighter shade/);
  });
  it("is quiet when everything reads", () => {
    expect(adviseTheme({ primary: "#4f46e5", sidebar: "#1a1a2e" }).every((a) => a.level === "good" || a.area === "Highlights on the nav bar")).toBe(true);
  });
});

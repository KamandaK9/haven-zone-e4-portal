import { adjustForContrast, bestForeground, contrast, normaliseHex, toOklch } from "./colour";
import { deriveTheme, type ThemeInput } from "./derive";

// Plain-English notes on how readable a colour choice will be, area by area,
// with a one-tap fix where there is one.

export type Advice = {
  area: "Nav bar" | "Highlights on the nav bar" | "Buttons" | "Links and icons on white pages";
  level: "good" | "ok" | "poor";
  message: string;
  fix?: { field: "primary" | "sidebar"; hex: string; label: string };
};

const WHITE = "#ffffff";

// The nearest shade of the brand colour that reads on white (darker) or that
// its button text reads on — whichever the colour is nearer to.
function deeper(hex: string): string | undefined {
  return adjustForContrast(hex, WHITE, 4.5);
}

export function adviseTheme(input: ThemeInput): Advice[] {
  const primary = normaliseHex(input.primary) ?? input.primary;
  const sidebar = normaliseHex(input.sidebar) ?? input.sidebar;
  const d = deriveTheme({ primary, sidebar });
  const out: Advice[] = [];

  // Nav bar: the words on it.
  const wordsOnNav = contrast(sidebar, d.light["sidebar-foreground"]);
  if (wordsOnNav >= 4.5) {
    out.push({ area: "Nav bar", level: "good", message: "The words on the nav bar are easy to read." });
  } else {
    const deep = adjustForContrast(sidebar, WHITE, 7);
    out.push({
      area: "Nav bar",
      level: "poor",
      message: "The nav bar is a mid-tone, so its words are hard to read. A deeper colour works better.",
      ...(deep ? { fix: { field: "sidebar" as const, hex: deep, label: "Use a deeper nav bar" } } : {}),
    });
  }

  // Highlights and icons sitting on the nav bar.
  const onNav = contrast(d.bright, sidebar);
  if (onNav < 3) {
    const deep = adjustForContrast(sidebar, WHITE, 7);
    out.push({
      area: "Highlights on the nav bar",
      level: "poor",
      message: "The highlighted menu item and icons will be hard to see on this nav bar. A darker nav bar makes them stand out.",
      ...(deep ? { fix: { field: "sidebar" as const, hex: deep, label: "Use a deeper nav bar" } } : {}),
    });
  } else if (d.bright !== primary) {
    out.push({
      area: "Highlights on the nav bar",
      level: "good",
      message: `Your colour is too dark to stand out on the nav bar, so a lighter shade (${d.bright}) is used there — it keeps the menu easy to scan.`,
    });
  } else {
    out.push({ area: "Highlights on the nav bar", level: "good", message: "Your colour stands out nicely on the nav bar." });
  }

  // Buttons: the label on them.
  const label = bestForeground(primary);
  const onButton = contrast(primary, label);
  if (onButton >= 4.5) {
    out.push({ area: "Buttons", level: "good", message: "Button labels are easy to read." });
  } else {
    // Whichever way is the smaller change: deeper (white label) or lighter (dark label).
    const darker = adjustForContrast(primary, WHITE, 4.5);
    const lighter = adjustForContrast(primary, "#14110d", 4.5);
    const pick = [darker, lighter].filter((x): x is string => !!x).sort((a, b) => Math.abs(toOklch(a).l - toOklch(primary).l) - Math.abs(toOklch(b).l - toOklch(primary).l))[0];
    out.push({
      area: "Buttons",
      level: onButton >= 3 ? "ok" : "poor",
      message: "Button labels are a little hard to read on this colour — a deeper or a lighter shade reads better.",
      ...(pick ? { fix: { field: "primary" as const, hex: pick, label: toOklch(pick).l < toOklch(primary).l ? "Use a deeper shade" : "Use a lighter shade" } } : {}),
    });
  }

  // Links and icons on the white pages.
  const onWhite = contrast(primary, WHITE);
  const fix = deeper(primary);
  if (onWhite >= 4.5) {
    out.push({ area: "Links and icons on white pages", level: "good", message: "Links and icons are easy to see on white pages." });
  } else if (onWhite >= 3) {
    out.push({
      area: "Links and icons on white pages",
      level: "ok",
      message: "Icons are clear, but small text links are a little faint. A slightly deeper shade is easier to read.",
      ...(fix ? { fix: { field: "primary" as const, hex: fix, label: "Use a deeper shade" } } : {}),
    });
  } else {
    out.push({
      area: "Links and icons on white pages",
      level: "poor",
      message: "This colour is too light for links and icons on white pages — they'll fade out. A deeper shade is much easier to see.",
      ...(fix ? { fix: { field: "primary" as const, hex: fix, label: "Use a deeper shade" } } : {}),
    });
  }
  return out;
}

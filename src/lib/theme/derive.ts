import { adjustForContrast, bestForeground, contrast, fromOklch, normaliseHex, toOklch, withLightness } from "./colour";

// Everything the portal's look needs, from two colours: the nav bar's
// background and the brand colour. Light and dark mode both, so people who
// use a dark screen get a matching one.

export type ThemeInput = { primary: string; sidebar: string };

export type Derived = {
  light: Record<string, string>;
  dark: Record<string, string>;
  // The brand colour as it appears on the nav bar (lightened if it needs to
  // be, to stand out) — also what the self check-in screen uses.
  bright: string;
};

const DARK_BG = "#14130f";
const SIDEBAR_TEXT_ON_DARK = "#f5f3ee";
const SIDEBAR_TEXT_ON_LIGHT = "#14110d";

function textOn(bg: string, preferDark: boolean): string {
  const preferred = preferDark ? SIDEBAR_TEXT_ON_LIGHT : SIDEBAR_TEXT_ON_DARK;
  return contrast(bg, preferred) >= 4.5 ? preferred : bestForeground(bg);
}

// The brand colour made to stand out on a given background: unchanged if it
// already does, else the nearest shade that does, else plain black or white.
function brandOn(primary: string, bg: string): string {
  return adjustForContrast(primary, bg, 4.5) ?? adjustForContrast(primary, bg, 3) ?? bestForeground(bg);
}

function sidebarTokens(sidebar: string, primary: string): { tokens: Record<string, string>; bright: string } {
  const dark = toOklch(sidebar).l < 0.55;
  const fg = textOn(sidebar, !dark);
  const bright = brandOn(primary, sidebar);
  const o = toOklch(sidebar);
  const accent = withLightness(sidebar, dark ? Math.min(0.95, o.l + 0.07) : Math.max(0.05, o.l - 0.06));
  return {
    bright,
    tokens: {
      sidebar,
      "sidebar-foreground": fg,
      "sidebar-primary": bright,
      "sidebar-primary-foreground": bestForeground(bright),
      "sidebar-accent": accent,
      "sidebar-accent-foreground": contrast(bright, accent) >= 4.5 ? bright : fg,
      "sidebar-border": dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
      "sidebar-ring": bright,
    },
  };
}

function chartColours(primary: string, o: { c: number; h: number }, lift = 0): string[] {
  return [
    primary,
    fromOklch({ l: 0.32 + lift * 2.5, c: 0.02, h: o.h }),
    fromOklch({ l: 0.62 + lift, c: 0.11, h: (o.h + 60) % 360 }),
    fromOklch({ l: 0.6 + lift, c: 0.1, h: (o.h + 150) % 360 }),
    fromOklch({ l: 0.52 + lift, c: 0.12, h: (o.h + 300) % 360 }),
  ];
}

export function deriveTheme(input: ThemeInput): Derived {
  const primary = normaliseHex(input.primary) ?? "#4f46e5";
  const sidebar = normaliseHex(input.sidebar) ?? "#1f1d5c";
  const o = toOklch(primary);

  const lightSide = sidebarTokens(sidebar, primary);
  const ramp = [
    fromOklch({ l: 0.92, c: o.c * 0.3, h: o.h }),
    fromOklch({ l: 0.82, c: o.c * 0.6, h: o.h }),
    fromOklch({ l: 0.72, c: o.c * 0.85, h: o.h }),
    primary,
  ];
  const lc = chartColours(primary, o);
  const light: Record<string, string> = {
    primary,
    "primary-foreground": bestForeground(primary),
    ring: fromOklch({ ...o, l: Math.min(0.85, o.l + 0.08) }),
    accent: fromOklch({ l: 0.955, c: Math.min(0.04, o.c * 0.5), h: o.h }),
    "accent-foreground": fromOklch({ l: 0.36, c: Math.min(0.09, o.c * 0.7), h: o.h }),
    "chart-1": lc[0], "chart-2": lc[1], "chart-3": lc[2], "chart-4": lc[3], "chart-5": lc[4],
    ...lightSide.tokens,
    "brand-chart": primary,
    "brand-ramp-1": ramp[0], "brand-ramp-2": ramp[1], "brand-ramp-3": ramp[2], "brand-ramp-4": ramp[3],
  };

  // Dark mode: the brand colour made readable on a dark page, and the nav bar
  // a little deeper than in light mode.
  const pd = brandOn(primary, DARK_BG);
  const od = toOklch(pd);
  const sl = toOklch(sidebar).l;
  const darkSidebar = withLightness(sidebar, sl < 0.22 ? sl * 0.8 : 0.18);
  const darkSide = sidebarTokens(darkSidebar, primary);
  const dc = chartColours(pd, od, 0.08);
  const darkRamp = [
    fromOklch({ l: 0.35, c: od.c * 0.4, h: od.h }),
    fromOklch({ l: 0.5, c: od.c * 0.7, h: od.h }),
    fromOklch({ l: 0.64, c: od.c * 0.9, h: od.h }),
    pd,
  ];
  const dark: Record<string, string> = {
    primary: pd,
    "primary-foreground": bestForeground(pd),
    ring: pd,
    accent: fromOklch({ l: 0.3, c: Math.min(0.05, od.c * 0.5), h: od.h }),
    "accent-foreground": fromOklch({ l: 0.92, c: Math.min(0.07, od.c * 0.5), h: od.h }),
    "chart-1": dc[0], "chart-2": "#d9d6d0", "chart-3": dc[2], "chart-4": dc[3], "chart-5": dc[4],
    ...darkSide.tokens,
    "brand-chart": pd,
    "brand-ramp-1": darkRamp[0], "brand-ramp-2": darkRamp[1], "brand-ramp-3": darkRamp[2], "brand-ramp-4": darkRamp[3],
  };

  return { light, dark, bright: lightSide.bright };
}

// CSS that sets those colours. `html:root` / `html.dark` out-rank the plain
// `:root` / `.dark` in the tenant's theme.css, wherever each stylesheet lands.
export function themeCss(d: Derived): string {
  const block = (vars: Record<string, string>) => Object.entries(vars).map(([k, v]) => `--${k}:${v};`).join("");
  return `html:root{${block(d.light)}}html.dark{${block(d.dark)}}`;
}

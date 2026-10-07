import type { CSSProperties } from "react";
import type { CheckInScreen } from "@/lib/check-in/screen";

// The self check-in look, shared by the kiosk, the QR phone page and the
// settings preview so they always match.

// Black or white text on the accent colour, whichever reads better.
export function onAccent(hex: string): string {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#ffffff";
}

export function lookColours(look: Pick<CheckInScreen, "accent" | "dark">, hasBackground: boolean) {
  const dark = look.dark || hasBackground;
  return {
    accent: look.accent,
    accentText: onAccent(look.accent),
    fg: dark ? "#ffffff" : "#111111",
    muted: dark ? "rgba(255,255,255,0.7)" : "rgba(17,17,17,0.6)",
    glass: dark ? "rgba(255,255,255,0.08)" : "rgba(17,17,17,0.04)",
    line: dark ? "rgba(255,255,255,0.18)" : "rgba(17,17,17,0.12)",
    dark,
  };
}

// The page backdrop: the photo darkened behind the text, or a soft accent glow.
export function backdropStyle(look: Pick<CheckInScreen, "accent" | "dark">, background?: string): CSSProperties {
  const accent = look.accent;
  if (background) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.85) 100%), url(${background})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return look.dark
    ? { background: `radial-gradient(ellipse at 50% -10%, ${accent}40 0%, transparent 55%), radial-gradient(ellipse at 50% 120%, ${accent}26 0%, transparent 50%), #0a0a0a` }
    : { background: `radial-gradient(ellipse at 50% -10%, ${accent}26 0%, transparent 55%), #fafafa` };
}

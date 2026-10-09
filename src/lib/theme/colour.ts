// Colour maths for the portal's theme: reading and writing hex, working in
// OKLCH (so "lighter" and "darker" mean what they look like), and checking
// readability with the WCAG contrast ratio. Pure, so it runs on the server
// (to build the theme) and in the browser (the live preview).

export type Rgb = [number, number, number]; // 0–255
export type Oklch = { l: number; c: number; h: number };

export function parseHex(input: string): Rgb | null {
  const m = input.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((x) => x + x).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;
}

export const isHex = (s: string) => parseHex(s) !== null;

export function toHex([r, g, b]: Rgb): string {
  const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

export const normaliseHex = (s: string): string | null => {
  const rgb = parseHex(s);
  return rgb ? toHex(rgb) : null;
};

const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

// WCAG relative luminance and contrast ratio (1–21).
export function luminance(hex: string): number {
  const rgb = parseHex(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function toOklch(hex: string): Oklch {
  const [r, g, b] = (parseHex(hex) ?? [0, 0, 0]).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  return { l: L, c, h: c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function oklchToLinear({ l: L, c, h }: Oklch): Rgb {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// Back to hex; a colour a screen can't show is brought in by lowering its
// chroma (keeping hue and lightness) rather than being clipped.
export function fromOklch(color: Oklch): string {
  const l = Math.max(0, Math.min(1, color.l));
  let c = Math.max(0, color.c);
  for (let i = 0; i < 60; i++) {
    const lin = oklchToLinear({ l, c, h: color.h });
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005)) return toHex(lin.map((v) => fromLinear(Math.max(0, Math.min(1, v)))) as Rgb);
    c -= 0.005;
    if (c <= 0) break;
  }
  return toHex(oklchToLinear({ l, c: 0, h: color.h }).map((v) => fromLinear(Math.max(0, Math.min(1, v)))) as Rgb);
}

export const withLightness = (hex: string, l: number): string => fromOklch({ ...toOklch(hex), l });

// The nearest shade of `hex` (same hue and richness, only lightness changes)
// that reads against `against` at `target` contrast, going lighter when the
// background is dark and darker when it's light. undefined if none does.
export function adjustForContrast(hex: string, against: string, target: number): string | undefined {
  if (contrast(hex, against) >= target) return normaliseHex(hex) ?? hex;
  const o = toOklch(hex);
  const lighter = luminance(against) < 0.4;
  for (let i = 1; i <= 100; i++) {
    const l = lighter ? o.l + i * 0.01 : o.l - i * 0.01;
    if (l < 0 || l > 1) return undefined;
    const candidate = fromOklch({ ...o, l });
    if (contrast(candidate, against) >= target) return candidate;
  }
  return undefined;
}

// Text on a coloured background: near-white or near-black, whichever reads better.
export function bestForeground(bg: string): string {
  return contrast(bg, "#ffffff") >= contrast(bg, "#14110d") ? "#ffffff" : "#14110d";
}

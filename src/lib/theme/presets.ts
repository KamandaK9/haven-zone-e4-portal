// Ready-made colour schemes: the nav bar's colour and the brand colour
// (buttons, links, icons). Everything else is worked out from these two
// (see derive.ts). A tenant offers some of them (tenant.theme.offered), and
// an admin can always pick any colour of their own.

export type ThemePreset = { key: string; label: string; primary: string; sidebar: string };

export const PRESETS: readonly ThemePreset[] = [
  { key: "gold", label: "Black & gold", primary: "#a07a1c", sidebar: "#1a1814" },
  { key: "blue", label: "Indigo", primary: "#4f46e5", sidebar: "#1f1d5c" },
  { key: "royal", label: "Blue", primary: "#1d5fd1", sidebar: "#0c2452" },
  { key: "purple", label: "Purple", primary: "#7433d6", sidebar: "#25104a" },
  { key: "green", label: "Green", primary: "#15803d", sidebar: "#0f2e1d" },
  { key: "burgundy", label: "Burgundy", primary: "#9f1239", sidebar: "#2b0a14" },
  { key: "slate", label: "Slate", primary: "#334155", sidebar: "#0f172a" },
];

export const presetByKey = (key: string | undefined): ThemePreset | undefined => PRESETS.find((p) => p.key === key);

// What's saved for an organisation: a preset (kept by name so the label can
// show) or its own colours, always with the two colours resolved.
export type SavedTheme = { preset?: string; primary: string; sidebar: string };

import { tenant } from "@/tenant";

// The self check-in screen's look: the organisation's saved choices
// (check_in_screen) over the tenant's defaults (tenant.checkInScreen).

export const CHECK_IN_SCREEN_BUCKET = "check-in-screen";

export type CheckInScreen = {
  title: string;
  tagline: string;
  accent: string;
  dark: boolean;
  backgroundUrl?: string;
};

export const DEFAULT_ACCENT = "#4f46e5";

export function resolveCheckInScreen(saved: { title?: string | null; tagline?: string | null } | null, backgroundUrl?: string, themeAccent?: string): CheckInScreen {
  const d = tenant.checkInScreen ?? {};
  return {
    title: saved?.title?.trim() || d.title || tenant.name,
    tagline: saved?.tagline?.trim() || d.tagline || "",
    accent: themeAccent ?? d.accent ?? tenant.chartPrimary ?? DEFAULT_ACCENT,
    dark: d.dark ?? false,
    backgroundUrl,
  };
}

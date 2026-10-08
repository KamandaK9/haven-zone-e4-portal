import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseHex } from "./colour";
import { deriveTheme, themeCss } from "./derive";
import { presetByKey, type SavedTheme } from "./presets";

// The organisation's saved colours, read once per request. A deployment has
// a single zone, so no signed-in user is needed (the login page is themed too).
export const getSavedTheme = cache(async (): Promise<SavedTheme | null> => {
  try {
    const { data } = await createAdminClient().from("zones").select("theme").limit(1).maybeSingle();
    return parseSavedTheme((data as { theme?: unknown } | null)?.theme);
  } catch {
    return null; // a missing theme must never take a page down
  }
});

export function parseSavedTheme(raw: unknown): SavedTheme | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const primary = typeof r.primary === "string" ? normaliseHex(r.primary) : undefined;
  const sidebar = typeof r.sidebar === "string" ? normaliseHex(r.sidebar) : undefined;
  if (!primary || !sidebar) return null;
  const preset = typeof r.preset === "string" && presetByKey(r.preset) ? r.preset : undefined;
  return { primary, sidebar, ...(preset ? { preset } : {}) };
}

// CSS for the root layout; null when nothing is saved (theme.css applies).
export async function getThemeCss(): Promise<string | null> {
  const saved = await getSavedTheme();
  return saved ? themeCss(deriveTheme(saved)) : null;
}

// The brand colour as it shows on a dark backdrop, for the check-in screen.
export async function getThemeAccent(): Promise<string | undefined> {
  const saved = await getSavedTheme();
  return saved ? deriveTheme(saved).bright : undefined;
}

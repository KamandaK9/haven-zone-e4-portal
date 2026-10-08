"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { normaliseHex } from "@/lib/theme/colour";
import { presetByKey } from "@/lib/theme/presets";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

// Saving the organisation's colours, or going back to the deployment's own.
export async function saveTheme(input: { primary: string; sidebar: string; preset?: string }): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_settings")) return { ok: false, error: "Only admins can change the colours." };
  const primary = normaliseHex(input.primary);
  const sidebar = normaliseHex(input.sidebar);
  if (!primary || !sidebar) return { ok: false, error: "Those colours aren't valid." };
  const preset = input.preset && presetByKey(input.preset) ? input.preset : undefined;

  const supabase = await createClient();
  const { error } = await supabase
    .from("zones")
    .update({ theme: { primary, sidebar, ...(preset ? { preset } : {}) } })
    .eq("id", profile.zoneId);
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "settings.theme", preset ? `Colours: ${presetByKey(preset)?.label}` : `Custom colours ${primary} / ${sidebar}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resetTheme(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_settings")) return { ok: false, error: "Only admins can change the colours." };
  const supabase = await createClient();
  const { error } = await supabase.from("zones").update({ theme: null }).eq("id", profile.zoneId);
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "settings.theme", "Colours reset to the default");
  revalidatePath("/", "layout");
  return { ok: true };
}

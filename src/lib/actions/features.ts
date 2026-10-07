"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { FEATURE_CATALOGUE, isIncluded } from "@/lib/modules";
import type { ModuleKey } from "@/lib/tenant";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

// Turning an included feature on or off for the whole organisation.
// Features outside the plan (tenant.modules) can't be switched on here.
export async function setFeatureEnabled(key: ModuleKey, enabled: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_settings")) return { ok: false, error: "Only admins can change features." };
  const feature = FEATURE_CATALOGUE.find((f) => f.key === key);
  if (!feature || feature.comingSoon) return { ok: false, error: "That feature isn't available yet." };
  if (!isIncluded(key)) return { ok: false, error: "That feature isn't in your plan." };

  const supabase = await createClient();
  const { data: zone } = await supabase.from("zones").select("disabled_modules").eq("id", profile.zoneId).single();
  const disabled = new Set(zone?.disabled_modules ?? []);
  if (enabled) disabled.delete(key);
  else disabled.add(key);
  const { error } = await supabase.from("zones").update({ disabled_modules: [...disabled] }).eq("id", profile.zoneId);
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "settings.feature", `${enabled ? "Turned on" : "Turned off"} ${feature.name}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

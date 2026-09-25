"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { applyRuleOverrides, diffRuleOverrides, validateRules } from "@/lib/handbook/rules";
import type { HandbookRules } from "@/lib/handbook/types";
import { tenant } from "@/tenant";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

// Saves the zone's category thresholds. Only the numbers are taken from
// `edited` — labels, colours and wording always come from the tenant — and
// only values that differ from the tenant defaults are stored. Pass null to
// go back to the defaults.
export async function updateHandbookRules(edited: HandbookRules | null): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_access")) return { ok: false, error: "Not permitted." };
  const defaults = tenant.handbook?.rules;
  if (!defaults) return { ok: false, error: "This portal has no handbook." };

  const overrides = edited ? diffRuleOverrides(defaults, edited) : null;
  // Validate what will actually be in force, not the client's copy.
  const problem = validateRules(applyRuleOverrides(defaults, overrides));
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("zones")
    .update({ handbook_rules: overrides })
    .eq("id", profile.zoneId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Couldn't save — the database hasn't been updated for this feature yet. Apply the latest migration and try again." };
  }

  await logAudit(
    profile,
    "settings.update_handbook_rules",
    overrides ? "Changed the handbook category thresholds" : "Reset the handbook category thresholds to the defaults"
  );
  revalidatePath("/handbook", "layout");
  revalidatePath("/settings");
  return { ok: true };
}

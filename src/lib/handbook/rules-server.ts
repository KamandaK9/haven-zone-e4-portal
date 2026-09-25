import "server-only";
import { createClient } from "@/lib/supabase/server";
import { tenant } from "@/tenant";
import { applyRuleOverrides, type RuleOverrides } from "./rules";
import type { HandbookRules } from "./types";

// The category thresholds in force for a zone — the tenant's defaults with
// the zone's own overrides applied — and whether any overrides exist.
// Null when the tenant ships no handbook.
export async function getHandbookRules(zoneId: string): Promise<{ rules: HandbookRules; customised: boolean } | null> {
  const defaults = tenant.handbook?.rules;
  if (!defaults) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.from("zones").select("handbook_rules").eq("id", zoneId).maybeSingle();
  // An error here is most likely the column not existing yet (migration not
  // applied) — the defaults are a correct answer either way.
  const overrides = !error && data?.handbook_rules && typeof data.handbook_rules === "object" ? (data.handbook_rules as RuleOverrides) : null;
  return { rules: applyRuleOverrides(defaults, overrides), customised: !!overrides };
}

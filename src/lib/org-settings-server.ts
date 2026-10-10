import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyOrgOverrides, defaultOrgSettings, type OrgSettings } from "@/lib/org-settings";

// The organisation's settings in force (see org-settings.ts). Read with the
// service role because the login page shows some of them before anyone signs
// in; only this one non-sensitive column is read. Without a zone id it's the
// deployment's organisation. Defaults if the column isn't there yet.
export const getOrgSettings = cache(async (zoneId?: string): Promise<OrgSettings> => {
  try {
    let query = createAdminClient().from("zones").select("settings");
    query = zoneId ? query.eq("id", zoneId) : query.eq("setup_complete", true).order("created_at").limit(1);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return defaultOrgSettings();
    return applyOrgOverrides(defaultOrgSettings(), data.settings);
  } catch {
    return defaultOrgSettings();
  }
});

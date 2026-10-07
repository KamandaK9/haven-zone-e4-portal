import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyLegalOverrides } from "@/lib/legal-settings";
import type { LegalConfig } from "@/lib/tenant";
import { tenant } from "@/tenant";

// The privacy details in force: the tenant's defaults with the
// organisation's own edits from Settings (zones.legal_settings) on top.
// Read with the service role because the public privacy notice and terms
// are shown before anyone signs in; only this one non-sensitive column is
// read. One organisation per deployment, so without a zone id it's the
// deployment's organisation. Falls back to the defaults if the column
// isn't there yet (migration not applied).
export const getLegal = cache(async (zoneId?: string): Promise<LegalConfig> => {
  try {
    let query = createAdminClient().from("zones").select("legal_settings");
    query = zoneId ? query.eq("id", zoneId) : query.eq("setup_complete", true).order("created_at").limit(1);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return tenant.legal;
    return applyLegalOverrides(tenant.legal, data.legal_settings);
  } catch {
    return tenant.legal;
  }
});

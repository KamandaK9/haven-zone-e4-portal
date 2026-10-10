"use server";

import { revalidatePath } from "next/cache";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { accountKeyFrom, validateOrgSettings, type OrgSettings } from "@/lib/org-settings";
import { getOrgSettings } from "@/lib/org-settings-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

export type OrgSettingsInput = Omit<OrgSettings, "bankAccounts"> & {
  // Existing accounts keep their key (records refer to it); new ones have none.
  bankAccounts: { key?: string; label: string }[];
};

// Saves Settings → Organisation over the tenant's defaults.
export async function updateOrgSettings(input: OrgSettingsInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_access")) return { ok: false, error: "Only admins who manage access can change these." };

  const current = await getOrgSettings(profile.zoneId);
  const known = new Set(current.bankAccounts.map((a) => a.key));
  const taken = [...known];
  const bankAccounts = input.bankAccounts
    .filter((a) => a.label.trim())
    .map((a) => {
      if (a.key && known.has(a.key)) return { key: a.key, label: a.label.trim() };
      const key = accountKeyFrom(a.label, taken);
      taken.push(key);
      return { key, label: a.label.trim() };
    });
  const tidy = (list: string[]) => [...new Set(list.map((x) => x.trim()).filter(Boolean))];
  const next: OrgSettings = {
    login: { headline: input.login.headline.trim(), blurb: input.login.blurb.trim() },
    bankAccounts,
    meetingTypes: tidy(input.meetingTypes),
    departmentSuggestions: tidy(input.departmentSuggestions),
    attendance: { activeMinSundays: Number(input.attendance.activeMinSundays), absenceAlertAfter: Number(input.attendance.absenceAlertAfter) },
  };
  const problem = validateOrgSettings(next);
  if (problem) return { ok: false, error: problem };

  // An account that cheques or bank advices are filed against stays.
  const removed = current.bankAccounts.filter((a) => !bankAccounts.some((b) => b.key === a.key));
  if (removed.length > 0) {
    const admin = createAdminClient();
    const keys = removed.map((a) => a.key);
    const [cheques, advices] = await Promise.all([
      admin.from("cheques").select("id", { count: "exact", head: true }).eq("zone_id", profile.zoneId).in("account", keys),
      admin.from("chapter_records").select("id", { count: "exact", head: true }).eq("zone_id", profile.zoneId).in("account", keys),
    ]);
    if ((cheques.count ?? 0) + (advices.count ?? 0) > 0) {
      return { ok: false, error: `${removed.map((a) => a.label).join(", ")} has cheques or bank advices filed against it — rename it instead of removing it.` };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("zones").update({ settings: next }).eq("id", profile.zoneId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Couldn't save — apply the latest database migration and try again." };
  await logAudit(profile, "settings.update_organisation", "Updated the organisation settings", {
    entity: { type: "zone", id: profile.zoneId },
    before: current,
    after: next,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

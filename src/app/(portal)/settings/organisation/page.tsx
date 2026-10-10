import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getModules } from "@/lib/modules-server";
import { getOrgSettings } from "@/lib/org-settings-server";

// The organisation's own wording and lists, editable without a developer.
export default async function OrganisationSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_access")) redirect("/dashboard");
  const [settings, modules] = await Promise.all([getOrgSettings(profile.zoneId), getModules()]);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Organisation" }]} />
        <h1 className="text-2xl font-semibold tracking-tight">Organisation</h1>
        <p className="text-sm text-muted-foreground">Wording and lists your organisation uses across the portal.</p>
      </div>
      <OrgSettingsForm settings={settings} show={{ records: modules.records, attendance: modules.attendance }} />
    </div>
  );
}

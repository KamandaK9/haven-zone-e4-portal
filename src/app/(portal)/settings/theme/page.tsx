import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ThemeForm } from "@/components/settings/theme-form";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getSavedTheme } from "@/lib/theme/server";
import { PRESETS, presetByKey } from "@/lib/theme/presets";
import { tenant } from "@/tenant";

export const metadata = { title: "Colours" };

export default async function ThemeSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_settings")) redirect("/settings");
  const saved = await getSavedTheme();
  const offered = tenant.theme ? PRESETS.filter((p) => tenant.theme!.offered.includes(p.key)) : PRESETS;
  // With nothing saved, the deployment's own look is showing.
  const shipped = presetByKey(tenant.theme?.default) ?? PRESETS[1];

  return (
    <div className="space-y-6 max-w-3xl">
      <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Colours" }]} />
      <ThemeForm
        presets={offered}
        current={saved ? { primary: saved.primary, sidebar: saved.sidebar, preset: saved.preset } : { primary: shipped.primary, sidebar: shipped.sidebar, preset: shipped.key }}
        isSaved={!!saved}
      />
    </div>
  );
}

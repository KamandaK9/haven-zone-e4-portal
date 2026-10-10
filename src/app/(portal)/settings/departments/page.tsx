import { redirect } from "next/navigation";
import { getOrgSettings } from "@/lib/org-settings-server";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DepartmentsEditor } from "@/components/settings/departments-editor";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getDepartmentMemberships, getDepartments } from "@/lib/data/departments";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_settings")) redirect("/settings");
  const [departments, memberships] = await Promise.all([getDepartments(), getDepartmentMemberships()]);
  const counts: Record<string, number> = {};
  for (const ids of Object.values(memberships)) for (const d of ids) counts[d] = (counts[d] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Departments" }]} />
      <Card>
        <CardHeader>
          <CardTitle>Departments</CardTitle>
          <CardDescription>
            Where people serve. Someone can be in several; it shows on their profile and you can filter members by it. It
            doesn&apos;t give anyone extra access — that&apos;s what roles are for.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DepartmentsEditor departments={departments} counts={counts} suggestions={(await getOrgSettings(profile.zoneId)).departmentSuggestions} />
        </CardContent>
      </Card>
    </div>
  );
}

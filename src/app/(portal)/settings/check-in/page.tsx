import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckInScreenForm } from "@/components/settings/check-in-screen-form";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getCheckInScreen } from "@/lib/data/check-in-screen";
import { requireModule } from "@/lib/require-module";
import { tenant } from "@/tenant";

export const metadata = { title: "Self check-in screen" };

export default async function CheckInScreenSettingsPage() {
  await requireModule("attendance");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_access")) redirect("/settings");
  const current = await getCheckInScreen(profile.zoneId);

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Self check-in screen" }]} />
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Self check-in screen</CardTitle>
            <CardDescription>What people see on the tablet at the door: your welcome, your tagline, your picture.</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/check-in/kiosk">Open self check-in</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <CheckInScreenForm
            current={current}
            defaults={{ title: tenant.checkInScreen?.title || tenant.name, tagline: tenant.checkInScreen?.tagline ?? "" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

import { redirect } from "next/navigation";
import { KioskLoader } from "@/components/check-in/check-in-loader";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { requireAal2IfEnrolled } from "@/lib/mfa";
import { requireModule } from "@/lib/require-module";
import { createClient } from "@/lib/supabase/server";
import { labels } from "@/lib/labels";
import { tenant } from "@/tenant";
import { getCheckInScreen } from "@/lib/data/check-in-screen";

export const metadata = { title: `Self check-in · ${tenant.portalName}` };

// The self check-in kiosk: signed in once by a volunteer, then used by
// everyone arriving. Same permission and offline behaviour as /check-in.
export default async function KioskPage() {
  await requireModule("attendance");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.setupComplete) redirect("/setup");
  if (!can(profile, "check_in")) redirect(profile.role === "member" ? "/me" : "/dashboard");
  await requireAal2IfEnrolled();

  const supabase = await createClient();
  const { saved: _saved, ...screen } = await getCheckInScreen(profile.zoneId);
  void _saved;
  const { data: churches } = await supabase.from("churches").select("id, name, is_office").order("name");
  const locations = (churches ?? []).filter((c) => !c.is_office).map((c) => ({ id: c.id, name: c.name }));
  if (locations.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">You don&apos;t have a {labels.location.toLowerCase()} to check people in to yet.</p>;
  }
  return (
    <div className="min-h-dvh bg-background">
      <KioskLoader churches={locations} timeZone={tenant.timezone} screen={screen} />
    </div>
  );
}

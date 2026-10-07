import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { CheckInLoader } from "@/components/check-in/check-in-loader";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { requireAal2IfEnrolled } from "@/lib/mfa";
import { requireModule } from "@/lib/require-module";
import { createClient } from "@/lib/supabase/server";
import { tenant } from "@/tenant";
import { labels } from "@/lib/labels";

export const metadata = { title: `Check-in · ${tenant.portalName}` };

// Full-screen check-in for phones and tablets at the door. Installable
// (app/manifest.ts) and usable offline once opened online (public/sw.js).
export default async function CheckInPage() {
  requireModule("attendance");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.setupComplete) redirect("/setup");
  if (!can(profile, "check_in")) redirect(profile.role === "member" ? "/me" : "/dashboard");
  await requireAal2IfEnrolled();

  const supabase = await createClient();
  const { data: churches } = await supabase.from("churches").select("id, name, is_office").order("name");
  const locations = (churches ?? []).filter((c) => !c.is_office).map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link href="/dashboard" className="text-muted-foreground hover:text-foreground" aria-label="Back to the portal">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <BrandMark size={28} />
        <p className="font-semibold">Check-in</p>
      </header>
      {locations.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">You don&apos;t have a {labels.location.toLowerCase()} to check people in to yet.</p>
      ) : (
        <CheckInLoader churches={locations} timeZone={tenant.timezone} />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { ChildrenDesk } from "@/components/children/children-desk";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getChildren } from "@/lib/actions/children";
import { churchToday } from "@/lib/data/attendance";
import { createClient } from "@/lib/supabase/server";
import { smsIsConfigured } from "@/lib/messaging/twilio";
import { requireModule } from "@/lib/require-module";
import type { ServiceKind } from "@/lib/check-in/types";

export const metadata = { title: "Children's church" };

// Checking children in and out of children's church, with pick-up codes.
export default async function ChildrenPage({ searchParams }: { searchParams: Promise<{ church?: string; date?: string; kind?: string }> }) {
  await requireModule("attendance");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "check_in")) redirect("/dashboard");

  const supabase = await createClient();
  const { data: churches } = await supabase.from("churches").select("id, name, is_office").order("name");
  const locations = (churches ?? []).filter((c) => !c.is_office).map((c) => ({ id: c.id, name: c.name }));
  const p = await searchParams;
  const today = churchToday();
  const churchId = locations.find((c) => c.id === p.church)?.id ?? locations[0]?.id;
  if (!churchId) return <p className="p-6 text-sm text-muted-foreground">You don&apos;t have a location to check children in to yet.</p>;
  const kind = (["sunday", "midweek", "special"].includes(p.kind ?? "") ? p.kind : "sunday") as ServiceKind;
  const date = p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.date <= today ? p.date : today;
  const service = { churchId, date, kind, name: "" };

  const children = await getChildren(churchId);
  const { data: svc } = await supabase.from("services").select("id").match({ church_id: churchId, service_date: date, kind, name: "" }).maybeSingle();
  const { data: rows } = svc
    ? await supabase.from("child_checkins").select("id, child_name, guardian_name, guardian_phone, notes, checked_in_at, checked_out_at").eq("service_id", svc.id).order("checked_in_at")
    : { data: [] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Children&apos;s church</h1>
        <p className="text-sm text-muted-foreground">Check children in with their guardian, and release them only against the pick-up code.</p>
      </div>
      <ChildrenDesk
        churches={locations}
        service={service}
        today={today}
        kids={children}
        smsReady={smsIsConfigured()}
        checkIns={(rows ?? []).map((r) => ({
          id: r.id,
          childName: r.child_name,
          guardianName: r.guardian_name,
          guardianPhone: r.guardian_phone ?? "",
          notes: r.notes ?? "",
          at: new Date(r.checked_in_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }),
          out: !!r.checked_out_at,
        }))}
      />
    </div>
  );
}

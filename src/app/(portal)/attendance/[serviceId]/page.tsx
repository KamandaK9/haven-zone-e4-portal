import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getZoneCells } from "@/lib/data/cells";
import { serviceTitle } from "@/lib/data/attendance";
import { memberFullName } from "@/lib/data/analytics";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/require-module";
import { labels, lower } from "@/lib/labels";

export default async function ServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  await requireModule("attendance");
  const { serviceId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "view_attendance")) redirect("/dashboard");

  const supabase = await createClient();
  const { data: service } = await supabase.from("services").select("id, church_id, service_date, kind, name").eq("id", serviceId).maybeSingle();
  if (!service) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Attendance", href: "/attendance" }, { label: "Not found" }]} />
        <p className="text-sm text-muted-foreground">This service doesn&apos;t exist, or isn&apos;t in your scope.</p>
      </div>
    );
  }
  const [{ data: rows }, ds, cells] = await Promise.all([
    supabase.from("attendance").select("member_id, checked_in_at").eq("service_id", service.id),
    getZoneDataset(profile.zoneId),
    getZoneCells(profile.zoneId),
  ]);
  const byId = new Map(ds.members.map((m) => [m.id, m]));
  const cellName = new Map(cells.map((c) => [c.id, c.name]));
  const people = (rows ?? [])
    .map((r) => ({ m: byId.get(r.member_id), at: r.checked_in_at }))
    .filter((p): p is { m: NonNullable<typeof p.m>; at: string } => !!p.m)
    .sort((a, b) => memberFullName(a.m).localeCompare(memberFullName(b.m)));
  const firstTimers = people.filter((p) => p.m.isVisitor && p.m.joinDate === service.service_date);
  const date = new Date(`${service.service_date}T12:00:00`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const location = ds.churches.find((c) => c.id === service.church_id)?.name;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Attendance", href: "/attendance" }, { label: `${serviceTitle(service)}, ${date}` }]} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{serviceTitle(service)}</h1>
        <p className="text-sm text-muted-foreground">
          {date} · {location} · {people.length} checked in
          {firstTimers.length > 0 && ` · ${firstTimers.length} first-timer${firstTimers.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Who came</CardTitle>
          <CardDescription>
            {profile.scope === "cell" ? `Members of your ${lower(labels.cell)} only` : `Everyone checked in`}
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {people.length === 0 && <p className="text-sm text-muted-foreground">Nobody checked in yet.</p>}
          {people.map(({ m, at }) => (
            <Link key={m.id} href={`/members/${m.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary">
              <span className="flex items-center gap-2">
                {memberFullName(m)}
                {m.isVisitor && <Badge variant="secondary">First-timer</Badge>}
              </span>
              <span className="text-xs text-muted-foreground">
                {(m.cellId && cellName.get(m.cellId)) || "—"} ·{" "}
                {new Date(at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

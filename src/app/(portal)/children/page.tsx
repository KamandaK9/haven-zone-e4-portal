import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChildrenDesk } from "@/components/children/children-desk";
import { ChildrenList } from "@/components/children/children-list";
import { DeleteMaterialButton, UploadMaterialDialog } from "@/components/children/materials-dialog";
import { nextAgeGroup } from "@/lib/children/graduation";
import { signedReadUrls } from "@/lib/storage/private-files";
import { RESOURCES_BUCKET } from "@/lib/resources/bucket";
import { tenant } from "@/tenant";
import { cn } from "@/lib/utils";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getChildren } from "@/lib/actions/children";
import { churchToday } from "@/lib/data/attendance";
import { createClient } from "@/lib/supabase/server";
import { smsIsConfigured } from "@/lib/messaging/twilio";
import { requireModule } from "@/lib/require-module";
import type { ServiceKind } from "@/lib/check-in/types";

export const metadata = { title: "Children's church" };

// Checking children in and out of children's church, with pick-up codes.
export default async function ChildrenPage({ searchParams }: { searchParams: Promise<{ church?: string; date?: string; kind?: string; tab?: string }> }) {
  await requireModule("attendance");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const canCheckIn = can(profile, "check_in");
  const canManage = can(profile, "manage_children");
  if (!canCheckIn && !canManage) redirect("/dashboard");

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

  const tabs = [
    ...(canCheckIn ? [{ key: "checkin", label: "Check-in" }] : []),
    { key: "children", label: "All children" },
    { key: "lessons", label: "Lessons & materials" },
  ];
  const tab = tabs.find((t) => t.key === p.tab)?.key ?? tabs[0].key;
  const here = locations.find((c) => c.id === churchId);

  const children = await getChildren(churchId);
  const { data: svc } = tab === "checkin" ? await supabase.from("services").select("id").match({ church_id: churchId, service_date: date, kind, name: "" }).maybeSingle() : { data: null };
  const { data: rows } = svc
    ? await supabase.from("child_checkins").select("id, child_name, guardian_name, guardian_phone, notes, checked_in_at, checked_out_at").eq("service_id", svc.id).order("checked_in_at")
    : { data: [] };

  const materials = tab === "lessons" ? ((await supabase.from("resources").select("*").eq("kind", "children").order("lesson_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false })).data ?? []) : [];
  const downloads = await signedReadUrls(RESOURCES_BUCKET, materials.map((m) => m.file_path).filter((x): x is string => !!x), true);
  const fromGroup = tenant.childrenCheckIn?.ageGroups[0] ?? "children";
  const nextGroup = nextAgeGroup(tenant.ageGroups ?? [], fromGroup)?.label;

  const tabHref = (key: string) => `/children?${new URLSearchParams({ tab: key, church: churchId })}`;
  const formatDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Children&apos;s church</h1>
          <p className="text-sm text-muted-foreground">
            {tab === "checkin" && "Check children in with their guardian, and release them only against the pick-up code."}
            {tab === "children" && `Every child${here ? ` at ${here.name}` : ""}, who collects them, and when they move up.`}
            {tab === "lessons" && "Lessons and resources for the teachers."}
          </p>
        </div>
        {tab === "lessons" && canManage && <UploadMaterialDialog />}
      </div>

      <nav aria-label="Children's church sections" className="-mx-1 overflow-x-auto border-b">
        <ul className="flex min-w-max gap-1 px-1">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={tabHref(t.key)}
                aria-current={t.key === tab ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  t.key === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab !== "checkin" && locations.length > 1 && tab === "children" && (
        <div className="flex flex-wrap gap-2">
          {locations.map((l) => (
            <Button key={l.id} asChild size="sm" variant={l.id === churchId ? "default" : "outline"}>
              <Link href={`/children?${new URLSearchParams({ tab, church: l.id })}`}>{l.name}</Link>
            </Button>
          ))}
        </div>
      )}

      {tab === "checkin" && (
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
      )}

      {tab === "children" && <ChildrenList kids={children} churchId={churchId} today={today} canManage={canManage} nextGroup={nextGroup} />}

      {tab === "lessons" && (
        <div className="space-y-3">
          {materials.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center space-y-1">
              <p className="font-medium">No lessons or resources yet</p>
              <p className="text-sm text-muted-foreground">
                {canManage ? "Upload the lesson plans, slides and worksheets the teachers need." : "The head of children's church will add them here."}
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {materials.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {m.title} <Badge variant="secondary">{m.file_name ? m.file_name.split(".").pop()?.toUpperCase() : "LINK"}</Badge>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[m.lesson_date && `For ${formatDate(m.lesson_date)}`, m.description, `Added ${new Date(m.created_at).toLocaleDateString("en-ZA")}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {m.link_url ? (
                      <Button asChild variant="outline" size="sm" className="gap-1.5">
                        <a href={m.link_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </a>
                      </Button>
                    ) : (
                      m.file_path &&
                      downloads.get(m.file_path) && (
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <a href={downloads.get(m.file_path)}>
                            <Download className="h-3.5 w-3.5" /> Download
                          </a>
                        </Button>
                      )
                    )}
                    {canManage && <DeleteMaterialButton id={m.id} title={m.title} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

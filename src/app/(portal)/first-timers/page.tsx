import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getNewcomers } from "@/lib/data/journey";
import { memberFullName } from "@/lib/data/analytics";
import { STAGES, type StageKey } from "@/lib/journey/stages";
import { requireModule } from "@/lib/require-module";
import { cn } from "@/lib/utils";

export const metadata = { title: "First-timers" };

const NEXT_STEP: Record<StageKey, string> = {
  new: "Reach out — a call or a text",
  contacted: "Place them in a cell",
  cell: "Invite them to Foundation School",
  course: "Keep them coming — confirm them as a member when ready",
  member: "Invite them to serve in a department",
  worker: "Serving",
};

export default async function FirstTimersPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  await requireModule("attendance");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "view_attendance")) redirect("/dashboard");

  const ds = await getZoneDataset(profile.zoneId);
  const newcomers = await getNewcomers(ds.members);
  const wanted = (await searchParams).stage;
  const stage = STAGES.find((s) => s.key === wanted)?.key;
  const shown = stage ? newcomers.filter((n) => n.stage === stage) : newcomers.filter((n) => n.stage !== "worker");
  const count = (k: StageKey) => newcomers.filter((n) => n.stage === k).length;
  const stuck = newcomers.filter((n) => n.stuck).length;
  const churchName = new Map(ds.churches.map((c) => [c.id, c.name]));
  const manySubgroups = ds.churches.filter((c) => !c.isOffice).length > 1;
  const canSeePhone = can(profile, "view_contact_details");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">First-timers</h1>
        <p className="text-sm text-muted-foreground">
          Everyone new in the last 90 days, and how far along they are. It updates itself as people are contacted, placed in a cell, and join Foundation School.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s) => (
          <Link
            key={s.key}
            href={stage === s.key ? "/first-timers" : `/first-timers?stage=${s.key}`}
            className={cn("rounded-xl border p-3 transition-colors hover:bg-muted/50", stage === s.key && "border-primary bg-primary/5")}
            title={s.hint}
          >
            <p className="text-2xl font-semibold tabular-nums">{count(s.key)}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </div>

      {stuck > 0 && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {stuck} {stuck === 1 ? "person has" : "people have"} been waiting too long at their step — they&apos;re at the top.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{stage ? STAGES.find((s) => s.key === stage)!.label : "Still on their way"}</CardTitle>
          <CardDescription>{stage ? STAGES.find((s) => s.key === stage)!.hint : "Everyone who hasn't yet become a member or started serving"}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {shown.length === 0 ? (
            <p className="p-6 pt-0 text-sm text-muted-foreground">
              {newcomers.length === 0 ? "No first-timers yet. They appear here once people check in as first-timers or join." : "Nobody at this step."}
            </p>
          ) : (
            <div className="divide-y border-t">
              {shown.map(({ member: m, stage: st, daysSinceJoin, stuck: isStuck }) => (
                <Link key={m.id} href={`/members/${m.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {memberFullName(m)}
                      <Badge variant="secondary" className="font-normal">{STAGES.find((s) => s.key === st)!.label}</Badge>
                      {isStuck && <Badge variant="outline" className="border-amber-300 font-normal text-amber-800">Waiting {daysSinceJoin} days</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {NEXT_STEP[st]}
                      {manySubgroups ? ` · ${churchName.get(m.churchId)}` : ""} · joined {daysSinceJoin === 0 ? "today" : `${daysSinceJoin} days ago`}
                    </p>
                  </div>
                  {canSeePhone && m.phone && (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {m.phone}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

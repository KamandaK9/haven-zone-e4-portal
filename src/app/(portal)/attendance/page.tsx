import Link from "next/link";
import { getOrgSettings } from "@/lib/org-settings-server";
import { redirect } from "next/navigation";
import { ClipboardCheck, UserCheck, UserX, HelpCircle, ScanLine } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FollowUpDialog, OUTCOMES } from "@/components/attendance/follow-up-dialog";
import { AssignFollowUpDialog } from "@/components/attendance/assign-follow-up-dialog";
import { getFollowUpTasks } from "@/lib/data/follow-up-tasks";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getZoneCells } from "@/lib/data/cells";
import { churchToday, getAttendanceData, serviceTitle } from "@/lib/data/attendance";
import { summarise } from "@/lib/attendance/summary";
import { memberFullName } from "@/lib/data/analytics";
import { requireModule } from "@/lib/require-module";
import { labels, lower } from "@/lib/labels";
import { describeScope } from "@/lib/scope-label";

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });

export default async function AttendancePage() {
  await requireModule("attendance");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "view_attendance")) redirect(can(profile, "check_in") ? "/check-in" : "/dashboard");

  const [ds, cells, data] = await Promise.all([getZoneDataset(profile.zoneId), getZoneCells(profile.zoneId), getAttendanceData()]);
  const today = churchToday();
  const cellName = new Map(cells.map((c) => [c.id, c.name]));
  const churchName = new Map(ds.churches.map((c) => [c.id, c.name]));

  // Members are already limited to the viewer's scope (RLS) — for a cell
  // role, the cells they lead or belong to.
  const members = ds.members.filter((m) => !m.isVisitor);
  const rules = (await getOrgSettings(profile.zoneId)).attendance;
  const standing = summarise(members, data.services, data.attendance, today, rules);
  const counts = { active: 0, irregular: 0, unknown: 0 };
  for (const s of standing.values()) counts[s.status]++;

  const lastFollowUp = new Map<string, (typeof data.followUps)[number]>();
  for (const f of data.followUps) if (!lastFollowUp.has(f.memberId)) lastFollowUp.set(f.memberId, f);

  const needFollowUp = members
    .map((m) => ({ m, s: standing.get(m.id)! }))
    .filter(({ s }) => s.missedInARow >= rules.absenceAlertAfter)
    .sort((a, b) => b.s.missedInARow - a.s.missedInARow || memberFullName(a.m).localeCompare(memberFullName(b.m)));

  const visitors = ds.members.filter((m) => m.isVisitor);
  const openTasks = new Map((await getFollowUpTasks()).filter((t) => t.status === "open").map((t) => [t.memberId, t]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Services, who came, and who needs a follow-up across {describeScope(profile, ds)}.
          </p>
        </div>
        {can(profile, "check_in") && (
          <Button asChild className="gap-2">
            <Link href="/check-in">
              <ScanLine className="h-4 w-4" /> Open check-in
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active" value={String(counts.active)} icon={UserCheck} />
        <StatCard label="Irregular" value={String(counts.irregular)} icon={UserX} />
        <StatCard label="Need follow-up" value={String(needFollowUp.length)} icon={ClipboardCheck} />
        <StatCard label="Not enough Sundays yet" value={String(counts.unknown)} icon={HelpCircle} />
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Active means at least {rules.activeMinSundays} Sunday services in the last 30 days. Members are flagged
        for follow-up after {rules.absenceAlertAfter} missed Sundays in a row.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Need a follow-up</CardTitle>
          <CardDescription>
            Missed {rules.absenceAlertAfter} or more Sundays in a row
            {profile.scope === "cell" ? ` — your ${lower(labels.cell)}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {needFollowUp.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {data.services.some((s) => s.kind === "sunday")
                ? "Nobody right now."
                : "Nothing to show until Sunday services have been checked in."}
            </p>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>{labels.cell}</TableHead>
                    <TableHead>Missed</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {needFollowUp.map(({ m, s }) => {
                    const f = lastFollowUp.get(m.id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Link href={`/members/${m.id}`} className="font-medium hover:text-primary">
                            {memberFullName(m)}
                          </Link>
                          {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{(m.cellId && cellName.get(m.cellId)) || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {s.missedInARow} Sundays
                          <p className="text-xs text-muted-foreground">
                            {s.lastAttended ? `Last in ${formatDate(s.lastAttended)}` : "Not checked in yet"}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {openTasks.get(m.id) ? (
                            <span className="text-foreground">
                              {openTasks.get(m.id)!.assignedToName} · due {formatDate(openTasks.get(m.id)!.dueDate)}
                            </span>
                          ) : f ? (
                            `${OUTCOMES.find((o) => o.value === f.outcome)?.label ?? f.outcome} · ${formatDate(f.createdAt.slice(0, 10))}`
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {can(profile, "record_follow_up") && !openTasks.get(m.id) && (
                              <AssignFollowUpDialog memberId={m.id} memberName={m.firstName} myId={profile.userId} />
                            )}
                            {can(profile, "record_follow_up") && <FollowUpDialog memberId={m.id} memberName={memberFullName(m)} />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent services</CardTitle>
          <CardDescription>The last 12 weeks</CardDescription>
        </CardHeader>
        <CardContent>
          {data.services.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No services yet. A service appears here as soon as someone is checked in to it.
            </p>
          ) : (
            <div className="rounded-xl border divide-y">
              {data.services.map((s) => (
                <Link
                  key={s.id}
                  href={`/attendance/${s.id}`}
                  className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {serviceTitle(s)} · {formatDate(s.date)}
                    </p>
                    <p className="text-xs text-muted-foreground">{churchName.get(s.churchId)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.firstTimers > 0 && <Badge variant="secondary">{s.firstTimers} first-timer{s.firstTimers === 1 ? "" : "s"}</Badge>}
                    <span className="text-sm font-semibold tabular-nums">{s.attendees}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {visitors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>First-timers</CardTitle>
            <CardDescription>Added at check-in — confirm them as members from their page</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {visitors.map((v) => (
              <Link key={v.id} href={`/members/${v.id}`} className="flex justify-between py-2 text-sm hover:text-primary">
                <span>{memberFullName(v)}</span>
                <span className="text-muted-foreground">{churchName.get(v.churchId)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import { Download, CalendarCheck, UserPlus, UserCheck, GraduationCap } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dataset } from "@/lib/data/analytics";
import type { Cell } from "@/lib/data/types";
import type { ServiceRow } from "@/lib/data/attendance";
import type { AttendanceRow, MemberAttendance } from "@/lib/attendance/summary";
import { firstTimerReturns, sundayTrend } from "@/lib/attendance/report";
import { ATTENDANCE_RULES, type AttendanceRules } from "@/lib/attendance/rules";
import type { SubGroupRow } from "@/lib/attendance/compare";
import { labels, lower } from "@/lib/labels";

const short = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

// Reports for a deployment without giving: attendance, first-timers,
// cells and the course.
export function AttendanceReport({
  ds,
  cells,
  services,
  attendance,
  standing,
  course,
  comparison,
  canExport,
  rules = ATTENDANCE_RULES,
}: {
  rules?: AttendanceRules;
  ds: Dataset;
  cells: Cell[];
  services: ServiceRow[];
  attendance: AttendanceRow[];
  standing: Map<string, MemberAttendance>;
  course?: { name: string; completed: number; inProgress: number };
  // Sub-groups side by side — only for someone who sees more than one.
  comparison?: SubGroupRow[];
  canExport: boolean;
}) {
  const trend = sundayTrend(services);
  const avg = trend.length ? Math.round(trend.reduce((n, p) => n + p.total, 0) / trend.length) : 0;
  const peak = Math.max(1, ...trend.map((p) => p.total));
  const firstTimers = firstTimerReturns(
    ds.members.filter((m) => m.isVisitor).map((m) => ({ id: m.id, joinDate: m.joinDate })),
    services,
    attendance
  );
  const active = [...standing.values()].filter((s) => s.status === "active").length;
  const locations = ds.churches.filter((c) => !c.isOffice);
  const churchName = new Map(ds.churches.map((c) => [c.id, c.name]));

  const cellRows = cells
    .map((c) => {
      const members = ds.members.filter((m) => m.cellId === c.id && !m.isVisitor);
      const act = members.filter((m) => standing.get(m.id)?.status === "active").length;
      return { cell: c, members: members.length, active: act };
    })
    .filter((r) => r.members > 0)
    .sort((a, b) => b.active / b.members - a.active / a.members || b.members - a.members);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Attendance over the last 12 weeks.</p>
        </div>
        {canExport && (
          <Button asChild variant="outline" className="gap-2">
            <Link href="/reports/attendance-csv" prefetch={false}>
              <Download className="h-4 w-4" /> Download attendance (CSV)
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Average Sunday" value={avg.toLocaleString()} icon={CalendarCheck} />
        <StatCard label="Active members" value={active.toLocaleString()} icon={UserCheck} />
        <StatCard
          label="First-timers who came back"
          value={firstTimers.total ? `${firstTimers.returned} of ${firstTimers.total}` : "—"}
          icon={UserPlus}
        />
        {course && <StatCard label={`${course.name} completed`} value={course.completed.toLocaleString()} icon={GraduationCap} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sunday attendance</CardTitle>
          <CardDescription>
            {locations.length > 1 ? `All ${lower(labels.locations)} together, by week` : "By week"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Sunday services checked in yet.</p>
          ) : (
            <div className="flex h-48 items-end gap-2">
              {trend.map((p) => (
                <div key={p.date} className="flex flex-1 flex-col items-center gap-1" title={`${p.total} on ${p.date}`}>
                  <span className="text-[10px] tabular-nums text-muted-foreground">{p.total}</span>
                  <div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(4, (p.total / peak) * 150)}px` }} />
                  <span className="text-[10px] text-muted-foreground">{short(p.date)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {comparison && comparison.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>{labels.locations} side by side</CardTitle>
            <CardDescription>Active means {rules.activeMinSundays}+ Sundays in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] border-t text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">{labels.location}</th>
                  <th className="px-2 py-2 text-right font-medium">Members</th>
                  <th className="px-2 py-2 text-right font-medium">Active</th>
                  <th className="px-2 py-2 text-right font-medium">Avg Sunday</th>
                  <th className="px-2 py-2 text-right font-medium">New (30 days)</th>
                  <th className="px-2 py-2 text-right font-medium">Need follow-up</th>
                  {course && <th className="px-4 py-2 text-right font-medium">{course.name}</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {comparison.map((r) => (
                  <tr key={r.churchId}>
                    <td className="px-4 py-2.5 font-medium">{churchName.get(r.churchId)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.members}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.activePct}%</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.averageSunday}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.firstTimers}</td>
                    <td className={`px-2 py-2.5 text-right tabular-nums ${r.needFollowUp > 0 ? "text-amber-700" : ""}`}>{r.needFollowUp}</td>
                    {course && <td className="px-4 py-2.5 text-right tabular-nums">{r.courseCompleted}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {locations.length > 1 && trend.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>By {lower(labels.location)}</CardTitle>
              <CardDescription>Average Sunday attendance</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {locations.map((loc) => {
                const weeks = trend.filter((p) => p.byChurch[loc.id] !== undefined);
                const a = weeks.length ? Math.round(weeks.reduce((n, p) => n + p.byChurch[loc.id], 0) / weeks.length) : 0;
                return (
                  <div key={loc.id} className="flex justify-between py-2 text-sm">
                    <span>{loc.name}</span>
                    <span className="tabular-nums text-muted-foreground">{weeks.length ? a : "—"}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{labels.cells}</CardTitle>
            <CardDescription>Members active in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {cellRows.length === 0 && <p className="text-sm text-muted-foreground">No {lower(labels.cells)} with members yet.</p>}
            {cellRows.map((r) => (
              <div key={r.cell.id} className="flex justify-between py-2 text-sm">
                <span>{r.cell.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {r.active} of {r.members}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {course && (
          <Card>
            <CardHeader>
              <CardTitle>{course.name}</CardTitle>
              <CardDescription>Everyone who has started it</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="font-semibold">{course.completed}</span> completed ·{" "}
                <span className="font-semibold">{course.inProgress}</span> in progress
              </p>
              <Link href="/courses" className="text-primary hover:underline">
                Open {course.name}
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

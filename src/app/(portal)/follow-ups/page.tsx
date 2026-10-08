import Link from "next/link";
import { redirect } from "next/navigation";
import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskActions } from "@/components/attendance/task-actions";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getFollowUpTasks } from "@/lib/data/follow-up-tasks";
import { churchToday } from "@/lib/data/attendance";
import { memberFullName } from "@/lib/data/analytics";
import { requireModule } from "@/lib/require-module";
import { cn } from "@/lib/utils";

export const metadata = { title: "Follow-ups" };

const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });

export default async function FollowUpsPage() {
  await requireModule("attendance");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "record_follow_up")) redirect("/dashboard");

  const [ds, tasks] = await Promise.all([getZoneDataset(profile.zoneId), getFollowUpTasks()]);
  const today = churchToday();
  const byId = new Map(ds.members.map((m) => [m.id, m]));
  const open = tasks.filter((t) => t.status === "open");
  const mine = open.filter((t) => t.assignedTo === profile.userId);
  const others = open.filter((t) => t.assignedTo !== profile.userId);
  const done = tasks.filter((t) => t.status === "done").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const overdue = (d: string) => d < today;
  const canSeePhone = can(profile, "view_contact_details");

  const row = (t: (typeof tasks)[number], isMine: boolean) => {
    const m = byId.get(t.memberId);
    const late = overdue(t.dueDate);
    return (
      <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            {m ? <Link href={`/members/${m.id}`} className="hover:text-primary">{memberFullName(m)}</Link> : "A member"}
            <Badge variant="outline" className={cn("font-normal", late && "border-red-300 text-red-700")}>{late ? "Overdue · " : "Due "}{day(t.dueDate)}</Badge>
          </p>
          <p className="text-xs text-muted-foreground">
            {isMine ? `From ${t.assignedByName ?? "a pastor"}` : `${t.assignedToName}${t.assignedByName ? ` · from ${t.assignedByName}` : ""}`}
            {t.note ? ` · “${t.note}”` : ""}
          </p>
          {canSeePhone && m?.phone && isMine && (
            <a href={`tel:${m.phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"><Phone className="h-3 w-3" /> {m.phone}</a>
          )}
        </div>
        <TaskActions taskId={t.id} memberName={m ? m.firstName : "them"} mine={isMine} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">People who need a call or a visit, and who&apos;s doing it.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mine</CardTitle>
          <CardDescription>{mine.length === 0 ? "Nothing waiting on you." : `${mine.length} to do${mine.some((t) => overdue(t.dueDate)) ? " — some are overdue" : ""}`}</CardDescription>
        </CardHeader>
        {mine.length > 0 && <CardContent className="p-0"><div className="divide-y border-t">{mine.map((t) => row(t, true))}</div></CardContent>}
      </Card>

      {others.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Everyone else&apos;s</CardTitle>
            <CardDescription>
              {others.length} open in your area{others.filter((t) => overdue(t.dueDate)).length > 0 ? ` · ${others.filter((t) => overdue(t.dueDate)).length} overdue` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0"><div className="divide-y border-t">{others.map((t) => row(t, false))}</div></CardContent>
        </Card>
      )}

      {done.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Done recently</CardTitle>
            <CardDescription>The last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="divide-y p-0">
            <div className="divide-y border-t">
              {done.slice(0, 20).map((t) => {
                const m = byId.get(t.memberId);
                return (
                  <p key={t.id} className="px-4 py-2 text-sm">
                    {m ? memberFullName(m) : "A member"} <span className="text-muted-foreground">· {t.assignedToName}{t.completedAt ? ` · ${day(t.completedAt.slice(0, 10))}` : ""}</span>
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

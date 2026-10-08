import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CellRegister } from "@/components/cells/cell-register";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getZoneCells } from "@/lib/data/cells";
import { churchToday } from "@/lib/data/attendance";
import { createClient } from "@/lib/supabase/server";
import { memberFullName } from "@/lib/data/analytics";
import { summariseCells } from "@/lib/cells/meetings";
import { requireModule } from "@/lib/require-module";
import { labels } from "@/lib/labels";

export const metadata = { title: "Cell meetings" };

const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });

export default async function CellMeetingsPage({ searchParams }: { searchParams: Promise<{ cell?: string; date?: string }> }) {
  await requireModule("attendance");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "take_cell_attendance") && !can(profile, "view_attendance")) redirect("/dashboard");

  const supabase = await createClient();
  const [ds, allCells, { data: scope }] = await Promise.all([getZoneDataset(profile.zoneId), getZoneCells(profile.zoneId), supabase.rpc("current_user_scope_cell_ids")]);
  const inScope = new Set((scope ?? []) as string[]);
  const cells = allCells.filter((c) => inScope.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  const today = churchToday();
  const params = await searchParams;
  const taking = can(profile, "take_cell_attendance");

  const since = new Date(Date.parse(`${today}T12:00:00Z`) - 84 * 86_400_000).toISOString().slice(0, 10);
  const { data: meetings } = await supabase.from("cell_meetings").select("id, cell_id, meeting_date").gte("meeting_date", since).limit(5000);
  const ids = (meetings ?? []).map((m) => m.id);
  const { data: rows } = ids.length ? await supabase.from("cell_meeting_attendance").select("meeting_id").in("meeting_id", ids).limit(100000) : { data: [] };
  const counts = new Map<string, number>();
  for (const r of rows ?? []) counts.set(r.meeting_id, (counts.get(r.meeting_id) ?? 0) + 1);
  const summaries = summariseCells(cells.map((c) => c.id), (meetings ?? []).map((m) => ({ cellId: m.cell_id, date: m.meeting_date, attendees: counts.get(m.id) ?? 0 })), today);
  const nameOf = new Map(cells.map((c) => [c.id, c.name]));

  // The register being taken.
  const cellId = cells.find((c) => c.id === params.cell)?.id ?? cells[0]?.id;
  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today ? params.date : today;
  let present: string[] = [];
  let note = "";
  let existing = false;
  if (cellId) {
    const { data: m } = await supabase.from("cell_meetings").select("id, note").eq("cell_id", cellId).eq("meeting_date", date).maybeSingle();
    if (m) {
      existing = true;
      note = m.note ?? "";
      const { data: att } = await supabase.from("cell_meeting_attendance").select("member_id").eq("meeting_id", m.id);
      present = (att ?? []).map((a) => a.member_id);
    }
  }
  const cellMembers = cellId ? ds.members.filter((m) => m.cellId === cellId && !m.isVisitor).map((m) => ({ id: m.id, name: memberFullName(m) })).sort((a, b) => a.name.localeCompare(b.name)) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{labels.cell} meetings</h1>
        <p className="text-sm text-muted-foreground">
          {taking ? `Take the register at your ${labels.cell.toLowerCase()} meeting, and see how every ${labels.cell.toLowerCase()} is meeting.` : `How every ${labels.cell.toLowerCase()} is meeting.`}
        </p>
      </div>

      {taking && cellId && (
        <Card>
          <CardHeader>
            <CardTitle>Take the register</CardTitle>
            <CardDescription>Tick who came.</CardDescription>
          </CardHeader>
          <CardContent>
            <CellRegister
              key={`${cellId}-${date}`}
              cells={cells.map((c) => ({ id: c.id, name: c.name }))}
              cellId={cellId}
              date={date}
              today={today}
              members={cellMembers}
              present={present}
              note={note}
              existing={existing}
            />
          </CardContent>
        </Card>
      )}
      {taking && !cellId && (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          You don&apos;t have a {labels.cell.toLowerCase()} yet. A pastor sets you as a {labels.cell.toLowerCase()}&apos;s leader on the cells page, or puts you in one.
        </p>
      )}

      {cells.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>How they&apos;re meeting</CardTitle>
            <CardDescription>The last 12 weeks</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y border-t">
              {summaries
                .sort((a, b) => Number(b.quiet) - Number(a.quiet) || a.cellId.localeCompare(b.cellId))
                .map((s) => (
                  <div key={s.cellId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {nameOf.get(s.cellId)}
                        {s.quiet && <Badge variant="outline" className="border-amber-300 font-normal text-amber-800">{s.lastMet ? `Quiet — last met ${day(s.lastMet)}` : "No register yet"}</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.meetings} meeting{s.meetings === 1 ? "" : "s"}{s.meetings > 0 ? ` · about ${s.averageAttendance} each` : ""}{s.lastMet && !s.quiet ? ` · last met ${day(s.lastMet)}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

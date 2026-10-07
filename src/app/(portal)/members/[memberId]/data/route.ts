import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/actions/audit";

// POPIA access request: everything held about one member, as a JSON file.
// Needs manage_members; pastoral notes only for view_pastoral_notes. Logged.
export async function GET(_req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !can(profile, "manage_members")) return new Response("Not permitted", { status: 403 });

  const supabase = await createClient();
  const { data: member } = await supabase.from("members").select("*").eq("id", memberId).maybeSingle();
  if (!member) return new Response("Not found", { status: 404 });

  const notes = can(profile, "view_pastoral_notes");
  const [church, cell, attendance, classes, cohorts, followUps, giving, trainings] = await Promise.all([
    supabase.from("churches").select("name").eq("id", member.church_id).maybeSingle(),
    member.cell_id ? supabase.from("cells").select("name").eq("id", member.cell_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("attendance").select("checked_in_at, services(service_date, kind, name)").eq("member_id", memberId),
    supabase.from("class_attendance").select("attended_on, course_classes(number, title)").eq("member_id", memberId),
    supabase.from("cohort_students").select("enrolled_at, cohorts(name)").eq("member_id", memberId),
    supabase.from("follow_ups").select(notes ? "created_at, outcome, note" : "created_at, outcome").eq("member_id", memberId),
    supabase.from("giving_entries").select("month, amount, category").eq("member_id", memberId),
    supabase.from("trainings").select("status, assigned_at, completed_at").eq("member_id", memberId),
  ]);

  const { photo_path: _photoPath, avatar_color: _avatar, ...details } = member;
  void _photoPath;
  void _avatar;
  const record = {
    exportedAt: new Date().toISOString(),
    exportedBy: profile.fullName,
    member: { ...details, location: church.data?.name ?? null, cell: cell.data?.name ?? null },
    attendance: attendance.data ?? [],
    courseClasses: classes.data ?? [],
    courseGroups: cohorts.data ?? [],
    followUps: followUps.data ?? [],
    giving: giving.data ?? [],
    training: trainings.data ?? [],
  };

  await logAudit(profile, "export.member_data", "Downloaded a member's full record (access request)", {
    entity: { type: "member", id: memberId },
  });
  const name = `${member.first_name}-${member.last_name}`.replace(/[^\w-]+/g, "_");
  return new Response(JSON.stringify(record, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-record.json"`,
      "Cache-Control": "no-store",
    },
  });
}

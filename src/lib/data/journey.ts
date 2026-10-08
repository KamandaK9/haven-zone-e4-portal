import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDepartmentMemberships } from "@/lib/data/departments";
import { churchToday } from "@/lib/data/attendance";
import { daysBetween, isStuck, stageOf, type StageKey } from "@/lib/journey/stages";
import type { Member } from "@/lib/data/types";

export type Newcomer = {
  member: Member;
  stage: StageKey;
  daysSinceJoin: number;
  stuck: boolean;
};

const WINDOW_DAYS = 90;

// Everyone who's still a first-timer, or joined in the last 90 days, with
// where they've got to. `members` is whatever the viewer can see.
export async function getNewcomers(members: Member[]): Promise<Newcomer[]> {
  const today = churchToday();
  const recent = members.filter((m) => m.isVisitor || (m.joinDate && daysBetween(m.joinDate, today) <= WINDOW_DAYS));
  if (recent.length === 0) return [];
  const ids = recent.map((m) => m.id);

  const supabase = await createClient();
  const admin = createAdminClient();
  const [{ data: followUps }, { data: enrolled }, memberships, { data: welcomes }] = await Promise.all([
    supabase.from("follow_ups").select("member_id").in("member_id", ids).limit(20000),
    supabase.from("cohort_students").select("member_id").in("member_id", ids).limit(20000),
    getDepartmentMemberships(),
    // A welcome text counts as contact; those messages belong to the system,
    // so they're read by the server (only for people already in scope).
    admin.from("message_recipients").select("member_id").in("member_id", ids).eq("status", "sent").limit(20000),
  ]);
  const contacted = new Set([...(followUps ?? []).map((r) => r.member_id), ...(welcomes ?? []).map((r) => r.member_id).filter((x): x is string => !!x)]);
  const inCourse = new Set((enrolled ?? []).map((r) => r.member_id));

  return recent
    .map((m) => {
      const days = m.joinDate ? daysBetween(m.joinDate, today) : 0;
      const stage = stageOf({
        isVisitor: m.isVisitor,
        hasCell: !!m.cellId,
        enrolledInCourse: inCourse.has(m.id),
        contacted: contacted.has(m.id),
        serves: m.role === "Worker" || (memberships[m.id]?.length ?? 0) > 0,
      });
      return { member: m, stage, daysSinceJoin: days, stuck: isStuck(stage, days) };
    })
    .sort((a, b) => Number(b.stuck) - Number(a.stuck) || a.daysSinceJoin - b.daysSinceJoin);
}

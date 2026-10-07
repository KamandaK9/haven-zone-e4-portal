"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

async function manager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!can(profile, "manage_courses")) return { ok: false as const, error: "Not permitted." };
  return { ok: true as const, profile, supabase: await createClient() };
}

const done = (paths: string[]): ActionResult => {
  for (const p of paths) revalidatePath(p);
  return { ok: true };
};

export async function renameClass(classId: string, title: string): Promise<ActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase.from("course_classes").update({ title: title.trim() }).eq("id", classId);
  return error ? { ok: false, error: error.message } : done(["/courses"]);
}

export type CohortInput = { churchId: string; name: string; startDate?: string; teacherProfileId?: string };

export async function createCohort(courseId: string, input: CohortInput): Promise<ActionResult & { id?: string }> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  if (!input.name.trim()) return { ok: false, error: "Give the class group a name." };
  const { data, error } = await supabase
    .from("cohorts")
    .insert({
      zone_id: profile.zoneId,
      course_id: courseId,
      church_id: input.churchId,
      name: input.name.trim(),
      start_date: input.startDate || null,
      teacher_profile_id: input.teacherProfileId || null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't create it." };
  await logAudit(profile, "course.cohort_create", `Started "${input.name.trim()}"`, { entity: { type: "cohort", id: data.id } });
  revalidatePath("/courses");
  return { ok: true, id: data.id };
}

export async function updateCohort(
  cohortId: string,
  patch: { name?: string; startDate?: string | null; teacherProfileId?: string | null; closed?: boolean }
): Promise<ActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase
    .from("cohorts")
    .update({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.startDate !== undefined ? { start_date: patch.startDate || null } : {}),
      ...(patch.teacherProfileId !== undefined ? { teacher_profile_id: patch.teacherProfileId || null } : {}),
      ...(patch.closed !== undefined ? { closed: patch.closed } : {}),
    })
    .eq("id", cohortId);
  return error ? { ok: false, error: error.message } : done(["/courses", `/courses/${cohortId}`]);
}

export async function enrolMembers(cohortId: string, memberIds: string[]): Promise<ActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  if (memberIds.length === 0) return { ok: true };
  const { error } = await supabase
    .from("cohort_students")
    .upsert(memberIds.map((member_id) => ({ cohort_id: cohortId, member_id, zone_id: profile.zoneId })), { ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "course.enrol", `Enrolled ${memberIds.length} in a class group`, { entity: { type: "cohort", id: cohortId } });
  return done([`/courses/${cohortId}`, "/courses"]);
}

export async function unenrolMember(cohortId: string, memberId: string): Promise<ActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const { error } = await auth.supabase.from("cohort_students").delete().match({ cohort_id: cohortId, member_id: memberId });
  return error ? { ok: false, error: error.message } : done([`/courses/${cohortId}`, "/courses"]);
}

// Ticking (or unticking) that a student attended a class. Teachers can do
// this for their own cohorts; RLS (can_teach_cohort) enforces it.
export async function setClassAttendance(
  cohortId: string,
  classId: string,
  memberId: string,
  attended: boolean,
  date?: string
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "teach_courses") && !can(profile, "manage_courses")) return { ok: false, error: "Not permitted." };
  const supabase = await createClient();
  if (attended) {
    const { error } = await supabase.from("class_attendance").upsert(
      { zone_id: profile.zoneId, class_id: classId, cohort_id: cohortId, member_id: memberId, attended_on: date, marked_by: profile.userId },
      { onConflict: "class_id,member_id", ignoreDuplicates: true }
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("class_attendance").delete().match({ class_id: classId, member_id: memberId, cohort_id: cohortId });
    if (error) return { ok: false, error: error.message };
  }
  return done([`/courses/${cohortId}`, `/members/${memberId}`]);
}

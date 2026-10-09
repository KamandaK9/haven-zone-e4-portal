import "server-only";
import { createClient } from "@/lib/supabase/server";
import { tenant } from "@/tenant";
import { signedReadUrls } from "@/lib/storage/private-files";
import { CLASS_MATERIALS_BUCKET } from "@/lib/courses/materials-bucket";

export type CourseClass = { id: string; number: number; title: string };
export type Course = { id: string; name: string; requiredClasses: number; classes: CourseClass[] };
export type CohortSummary = {
  id: string;
  name: string;
  churchId: string;
  startDate?: string;
  teacherProfileId?: string;
  closed: boolean;
  students: number;
};

export const classLabel = (c: CourseClass) => (c.title ? `${c.number}. ${c.title}` : `Class ${c.number}`);

// The deployment's course (tenant.course) and its classes, or undefined if it
// hasn't been created yet (ensureCourse in actions/courses.ts does that).
export async function getCourse(zoneId: string): Promise<Course | undefined> {
  if (!tenant.course) return undefined;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, name, required_classes")
    .eq("zone_id", zoneId)
    .eq("name", tenant.course.name)
    .maybeSingle();
  if (!course) return undefined;
  const { data: classes } = await supabase.from("course_classes").select("id, number, title").eq("course_id", course.id).order("number");
  return { id: course.id, name: course.name, requiredClasses: course.required_classes, classes: classes ?? [] };
}

// Creates the course and its numbered classes if it doesn't exist yet. Only
// succeeds for someone who manages courses (RLS); others just see nothing.
export async function getOrCreateCourse(zoneId: string, canCreate: boolean): Promise<Course | undefined> {
  const existing = await getCourse(zoneId);
  if (existing || !canCreate || !tenant.course) return existing;
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .insert({ zone_id: zoneId, name: tenant.course.name, required_classes: tenant.course.requiredClasses })
    .select("id")
    .single();
  if (!course) return getCourse(zoneId); // created concurrently
  await supabase
    .from("course_classes")
    .insert(Array.from({ length: tenant.course.classes }, (_, i) => ({ course_id: course.id, zone_id: zoneId, number: i + 1 })));
  return getCourse(zoneId);
}

// Every class attended by anyone the viewer can see, for completion counts.
export async function getVisibleClassAttendance(): Promise<{ classId: string; memberId: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("class_attendance").select("class_id, member_id").limit(50000);
  return (data ?? []).map((a) => ({ classId: a.class_id, memberId: a.member_id }));
}

// Cohorts the viewer may see (their scope, or the ones they teach).
export async function getCohorts(courseId: string): Promise<CohortSummary[]> {
  const supabase = await createClient();
  const { data: cohorts } = await supabase
    .from("cohorts")
    .select("id, name, church_id, start_date, teacher_profile_id, closed")
    .eq("course_id", courseId)
    .order("start_date", { ascending: false, nullsFirst: false });
  const ids = (cohorts ?? []).map((c) => c.id);
  const { data: students } = ids.length ? await supabase.from("cohort_students").select("cohort_id").in("cohort_id", ids) : { data: [] };
  return (cohorts ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    churchId: c.church_id,
    startDate: c.start_date ?? undefined,
    teacherProfileId: c.teacher_profile_id ?? undefined,
    closed: c.closed,
    students: (students ?? []).filter((s) => s.cohort_id === c.id).length,
  }));
}

// Logins who can teach (teach_courses), for choosing a cohort's teacher.
export async function getTeachers(zoneId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, caps").eq("zone_id", zoneId);
  return (data ?? [])
    .filter((p) => (p.caps ?? []).includes("teach_courses"))
    .map((p) => ({ id: p.id, name: p.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCohortDetail(cohortId: string) {
  const supabase = await createClient();
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, name, church_id, course_id, start_date, teacher_profile_id, closed")
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort) return undefined;
  const { data: roster } = await supabase.rpc("cohort_roster", { p_cohort_id: cohortId });
  const memberIds = (roster ?? []).map((r) => r.member_id);
  // Every class each student has attended, in any cohort the viewer can see —
  // so a make-up shows up.
  const { data: attendance } = memberIds.length
    ? await supabase.from("class_attendance").select("class_id, member_id, cohort_id, attended_on").in("member_id", memberIds)
    : { data: [] };
  return {
    cohort,
    students: (roster ?? [])
      .map((r) => ({ memberId: r.member_id, name: `${r.first_name} ${r.last_name}`.trim(), cell: r.cell_name ?? undefined }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    attendance: (attendance ?? []).map((a) => ({ classId: a.class_id, memberId: a.member_id, cohortId: a.cohort_id, date: a.attended_on })),
  };
}

// A member's classes attended and the cohorts they've been in.
export async function getMemberCourse(memberId: string) {
  const supabase = await createClient();
  const [{ data: attendance }, { data: enrolments }] = await Promise.all([
    supabase.from("class_attendance").select("class_id, attended_on").eq("member_id", memberId),
    supabase.from("cohort_students").select("cohort_id, cohorts(name)").eq("member_id", memberId),
  ]);
  return {
    attended: (attendance ?? []).map((a) => ({ classId: a.class_id, date: a.attended_on })),
    cohorts: (enrolments ?? []).map((e) => {
      const c = Array.isArray(e.cohorts) ? e.cohorts[0] : e.cohorts;
      return { id: e.cohort_id, name: (c as { name?: string } | null)?.name ?? "" };
    }),
  };
}

export type ClassMaterial = { id: string; classId: string; title: string; href: string; kind: "file" | "link"; fileName?: string };

// Every class's materials the viewer may open (managers and teachers), with
// fresh 5-minute links for uploaded files.
export async function getClassMaterials(): Promise<ClassMaterial[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("class_materials")
    .select("id, class_id, title, file_path, file_name, url")
    .order("sort_order")
    .order("created_at");
  const rows = data ?? [];
  const links = await signedReadUrls(CLASS_MATERIALS_BUCKET, rows.map((r) => r.file_path).filter((p): p is string => !!p));
  return rows
    .map((r) => ({
      id: r.id,
      classId: r.class_id,
      title: r.title,
      kind: r.file_path ? ("file" as const) : ("link" as const),
      href: r.file_path ? (links.get(r.file_path) ?? "") : (r.url ?? ""),
      fileName: r.file_name ?? undefined,
    }))
    .filter((m) => m.href);
}

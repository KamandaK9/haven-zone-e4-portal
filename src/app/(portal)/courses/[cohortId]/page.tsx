import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Register } from "@/components/courses/register";
import { EnrolDialog } from "@/components/courses/enrol-dialog";
import { CohortSettings } from "@/components/courses/cohort-settings";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getClassMaterials, getCohortDetail, getCourse, getTeachers, getVisibleClassAttendance } from "@/lib/data/courses";
import { getZoneCells } from "@/lib/data/cells";
import { courseProgress } from "@/lib/courses/progress";
import { memberFullName } from "@/lib/data/analytics";
import { requireModule } from "@/lib/require-module";
import { createClient } from "@/lib/supabase/server";
import { tenant } from "@/tenant";

export default async function CohortPage({ params }: { params: Promise<{ cohortId: string }> }) {
  await requireModule("courses");
  const { cohortId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const manages = can(profile, "manage_courses");
  if (!manages && !can(profile, "teach_courses")) redirect("/dashboard");

  const [course, detail, materials] = await Promise.all([getCourse(profile.zoneId), getCohortDetail(cohortId), getClassMaterials()]);
  const courseName = course?.name ?? tenant.course?.name ?? "Course";
  if (!course || !detail) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: courseName, href: "/courses" }, { label: "Not found" }]} />
        <p className="text-sm text-muted-foreground">This class group doesn&apos;t exist, or isn&apos;t yours.</p>
      </div>
    );
  }
  const { cohort, students, attendance } = detail;
  const isTeacher = cohort.teacher_profile_id === profile.userId;
  const canEdit = (isTeacher && can(profile, "teach_courses")) || manages;

  const supabase = await createClient();
  const { data: teacher } = cohort.teacher_profile_id
    ? await supabase.from("profiles").select("full_name").eq("id", cohort.teacher_profile_id).maybeSingle()
    : { data: null };

  // Who could be added: members of this sub-group not already in the group.
  let candidates: { id: string; name: string; cell?: string; done: boolean; firstTimer: boolean }[] = [];
  let teachers: { id: string; name: string }[] = [];
  if (manages) {
    const [ds, cells, all] = await Promise.all([getZoneDataset(profile.zoneId), getZoneCells(profile.zoneId), getVisibleClassAttendance()]);
    const cellName = new Map(cells.map((c) => [c.id, c.name]));
    const enrolled = new Set(students.map((s) => s.memberId));
    const classIds = course.classes.map((c) => c.id);
    candidates = ds.members
      .filter((m) => m.churchId === cohort.church_id && !enrolled.has(m.id))
      .map((m) => ({
        id: m.id,
        name: memberFullName(m),
        cell: m.cellId ? cellName.get(m.cellId) : undefined,
        firstTimer: m.isVisitor,
        done: courseProgress(all.filter((a) => a.memberId === m.id).map((a) => a.classId), classIds, course.requiredClasses).completed,
      }))
      .sort((a, b) => Number(b.firstTimer) - Number(a.firstTimer) || Number(a.done) - Number(b.done) || a.name.localeCompare(b.name));
    teachers = await getTeachers(profile.zoneId);
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: courseName, href: "/courses" }, { label: cohort.name }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            {cohort.name} {cohort.closed && <Badge variant="secondary">Finished</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {courseName} · {students.length} students · {teacher ? `Teacher: ${teacher.full_name}` : "No teacher yet"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {manages && <CohortSettings cohortId={cohort.id} teacherId={cohort.teacher_profile_id ?? undefined} closed={cohort.closed} teachers={teachers} />}
          {manages && !cohort.closed && <EnrolDialog cohortId={cohort.id} candidates={candidates} />}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Register</CardTitle>
          <CardDescription>
            Tick each class a student attends. {course.requiredClasses} classes complete {courseName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Register
            cohortId={cohort.id}
            classes={course.classes}
            required={course.requiredClasses}
            students={students}
            marks={attendance}
            canEdit={canEdit && !cohort.closed}
            canEnrol={manages && !cohort.closed}
          />
        </CardContent>
      </Card>

      {materials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Class materials</CardTitle>
            <CardDescription>What each class is taught from</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {course.classes
              .filter((c) => materials.some((m) => m.classId === c.id))
              .map((c) => (
                <div key={c.id} className="space-y-1 py-2.5 first:pt-0">
                  <p className="text-sm font-medium">{c.title ? `${c.number}. ${c.title}` : `Class ${c.number}`}</p>
                  {materials
                    .filter((m) => m.classId === c.id)
                    .map((m) => (
                      <a key={m.id} href={m.href} target="_blank" rel="noreferrer" className="block text-sm text-primary hover:underline">
                        {m.title}
                      </a>
                    ))}
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

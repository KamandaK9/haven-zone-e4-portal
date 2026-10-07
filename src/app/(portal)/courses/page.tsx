import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Users, BookOpen } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewCohortDialog } from "@/components/courses/new-cohort-dialog";
import { ClassTitles } from "@/components/courses/class-titles";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getCohorts, getOrCreateCourse, getTeachers, getVisibleClassAttendance } from "@/lib/data/courses";
import { courseProgress } from "@/lib/courses/progress";
import { requireModule } from "@/lib/require-module";
import { createClient } from "@/lib/supabase/server";
import { labels } from "@/lib/labels";
import { tenant } from "@/tenant";

export const metadata = { title: tenant.course?.name ?? "Courses" };

export default async function CoursesPage() {
  await requireModule("courses");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const manages = can(profile, "manage_courses");
  if (!manages && !can(profile, "teach_courses")) redirect("/dashboard");

  const course = await getOrCreateCourse(profile.zoneId, manages);
  if (!course) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{tenant.course?.name ?? "Courses"}</h1>
        <p className="text-sm text-muted-foreground">Not set up yet — someone who manages courses needs to open this page first.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const [cohorts, teachers, attendance, { data: churches }] = await Promise.all([
    getCohorts(course.id),
    manages ? getTeachers(profile.zoneId) : Promise.resolve([]),
    getVisibleClassAttendance(),
    supabase.from("churches").select("id, name, is_office").order("name"),
  ]);
  const locations = (churches ?? []).filter((c) => !c.is_office).map((c) => ({ id: c.id, name: c.name }));
  const churchName = new Map(locations.map((c) => [c.id, c.name]));
  const { data: teacherRows } = await supabase.from("profiles").select("id, full_name").in("id", cohorts.map((c) => c.teacherProfileId).filter((id): id is string => !!id));
  const teacherName = new Map((teacherRows ?? []).map((t) => [t.id, t.full_name]));

  const byMember = new Map<string, string[]>();
  for (const a of attendance) byMember.set(a.memberId, [...(byMember.get(a.memberId) ?? []), a.classId]);
  const classIds = course.classes.map((c) => c.id);
  const progress = [...byMember.values()].map((ids) => courseProgress(ids, classIds, course.requiredClasses));
  const completed = progress.filter((p) => p.completed).length;
  const inProgress = progress.length - completed;
  const open = cohorts.filter((c) => !c.closed);
  const closed = cohorts.filter((c) => c.closed);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{course.name}</h1>
          <p className="text-sm text-muted-foreground">
            {course.classes.length} classes · complete after {course.requiredClasses}. A class missed can be made up in a later group.
          </p>
        </div>
        {manages && <NewCohortDialog courseId={course.id} courseName={course.name} churches={locations} teachers={teachers} />}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Class groups running" value={String(open.length)} icon={Users} />
        <StatCard label="In progress" value={String(inProgress)} icon={BookOpen} />
        <StatCard label="Completed" value={String(completed)} icon={GraduationCap} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Class groups</CardTitle>
          <CardDescription>{manages ? "Every group in your scope" : "The groups you teach"}</CardDescription>
        </CardHeader>
        <CardContent>
          {cohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {manages ? "No class groups yet — start one with “New class group”." : "You haven't been given a class group yet."}
            </p>
          ) : (
            <div className="rounded-xl border divide-y">
              {[...open, ...closed].map((c) => (
                <Link key={c.id} href={`/courses/${c.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium flex items-center gap-2">
                      {c.name} {c.closed && <Badge variant="secondary">Finished</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        locations.length > 1 ? churchName.get(c.churchId) : null,
                        c.teacherProfileId ? `Teacher: ${teacherName.get(c.teacherProfileId) ?? "—"}` : "No teacher yet",
                        c.startDate ? `Started ${new Date(`${c.startDate}T12:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums shrink-0">{c.students} students</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Classes</CardTitle>
          <CardDescription>
            {manages ? "Name each class — the names show on every group's register." : `The ${course.classes.length} classes of ${course.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ClassTitles classes={course.classes} editable={manages} />
        </CardContent>
      </Card>
      {locations.length === 0 && <p className="text-xs text-muted-foreground">Add a {labels.location.toLowerCase()} first.</p>}
    </div>
  );
}

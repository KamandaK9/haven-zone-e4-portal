import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LessonListEditor } from "@/components/training/lesson-list-editor";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getCourseLessons, getQuizQuestionsForAuthor } from "@/lib/data/training-lessons";

export default async function CourseEditorPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_training")) redirect("/training");

  const ds = await getZoneDataset(profile.zoneId);
  const program = ds.trainingPrograms.find((p) => p.id === programId);
  if (!program) notFound();

  const lessons = await getCourseLessons(programId);

  // Prefetch every quiz lesson's questions (with the answer key — this page
  // is manage_training-only) so the edit dialog opens pre-filled.
  const quizQuestionsByLesson: Record<string, { question: string; options: string[]; correctIndex: number }[]> = {};
  for (const lesson of lessons.filter((l) => l.kind === "quiz")) {
    const questions = await getQuizQuestionsForAuthor(lesson.id);
    quizQuestionsByLesson[lesson.id] = questions.map((q) => ({ question: q.question, options: q.options, correctIndex: q.correctIndex }));
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/training" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Training
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{program.name}</h1>
        <p className="text-sm text-muted-foreground">Build this course out of one or more lessons — videos, or a graded quiz.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lessons</CardTitle>
          <CardDescription>Members go through these in order, on their own Training page.</CardDescription>
        </CardHeader>
        <CardContent>
          <LessonListEditor programId={programId} lessons={lessons} quizQuestionsByLesson={quizQuestionsByLesson} />
        </CardContent>
      </Card>
    </div>
  );
}

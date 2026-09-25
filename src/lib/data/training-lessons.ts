import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CourseLesson, LessonProgress, QuizQuestionForLearner } from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// The answer-key-free question count for a set of quiz lessons, via the
// quiz_question_counts() RPC — anyone in the zone can call it, unlike a
// direct select on training_quiz_questions (manage_training-only).
export async function getQuizQuestionCounts(supabase: SupabaseClient, lessonIds: string[]): Promise<Map<string, number>> {
  if (lessonIds.length === 0) return new Map();
  const { data } = await supabase.rpc("quiz_question_counts", { p_lesson_ids: lessonIds });
  return new Map((data ?? []).map((row) => [row.lesson_id, Number(row.count)]));
}

export async function getCourseLessons(programId: string): Promise<CourseLesson[]> {
  const supabase = await createClient();
  const { data: lessons } = await supabase
    .from("training_lessons")
    .select("*")
    .eq("program_id", programId)
    .order("sort_order");
  if (!lessons || lessons.length === 0) return [];

  // Question counts via the RPC, not a direct select — training_quiz_questions
  // itself is manage_training-only (it carries the answer key), so a plain
  // select here would silently come back empty for every member and every
  // quiz would show "0 questions".
  const quizLessonIds = lessons.filter((l) => l.kind === "quiz").map((l) => l.id);
  const counts = await getQuizQuestionCounts(supabase, quizLessonIds);

  return lessons.map((l) => ({
    id: l.id,
    programId: l.program_id,
    kind: l.kind,
    title: l.title,
    description: l.description ?? undefined,
    videoUrl: l.video_url ?? undefined,
    durationLabel: l.duration_label ?? undefined,
    passThreshold: l.pass_threshold ?? undefined,
    sortOrder: l.sort_order,
    questionCount: l.kind === "quiz" ? (counts.get(l.id) ?? 0) : undefined,
    hostedVideo:
      l.kind === "video" && l.video_provider && l.video_status
        ? {
            provider: l.video_provider,
            status: l.video_status,
            playbackId: l.video_playback_id ?? undefined,
            durationSeconds: l.duration_seconds ?? undefined,
          }
        : undefined,
  }));
}

// One query for every program's lesson count — used by the staff overview
// so each card can say "3 lessons" without an N+1 fetch per card.
export async function getLessonCountsByProgram(programIds: string[]): Promise<Map<string, number>> {
  if (programIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("training_lessons").select("program_id").in("program_id", programIds);
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.program_id, (counts.get(row.program_id) ?? 0) + 1);
  return counts;
}

export async function getLessonProgress(memberId: string, lessonIds: string[]): Promise<Map<string, LessonProgress>> {
  if (lessonIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_lesson_progress")
    .select("lesson_id, completed, completed_at, quiz_score, watched_seconds")
    .eq("member_id", memberId)
    .in("lesson_id", lessonIds);

  return new Map(
    (data ?? []).map((p) => [
      p.lesson_id,
      {
        lessonId: p.lesson_id,
        completed: p.completed,
        completedAt: p.completed_at ?? undefined,
        quizScore: p.quiz_score ?? undefined,
        watchedSeconds: Number(p.watched_seconds ?? 0),
      },
    ])
  );
}

// The answer-key-free view a learner's quiz page reads — see
// quiz_questions_for_member() in the migration.
export async function getQuizQuestionsForMember(lessonId: string): Promise<QuizQuestionForLearner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quiz_questions_for_member", { p_lesson_id: lessonId });
  if (error || !data) return [];
  return data.map((q) => ({ id: q.id, question: q.question, options: q.options, sortOrder: q.sort_order }));
}

// For the staff editor, which needs the answer key too — gated the same way
// the raw table's RLS is (manage_training), so this just surfaces whatever
// RLS already allows the caller to see.
export async function getQuizQuestionsForAuthor(
  lessonId: string
): Promise<{ id: string; question: string; options: string[]; correctIndex: number; sortOrder: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_quiz_questions")
    .select("id, question, options, correct_index, sort_order")
    .eq("lesson_id", lessonId)
    .order("sort_order");
  return (data ?? []).map((q) => ({ id: q.id, question: q.question, options: q.options, correctIndex: q.correct_index, sortOrder: q.sort_order }));
}

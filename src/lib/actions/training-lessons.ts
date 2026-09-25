"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function refreshTrainingPages(programId?: string) {
  revalidatePath("/training");
  if (programId) revalidatePath(`/training/${programId}`);
  revalidatePath("/me/training", "layout");
  revalidatePath("/dashboard");
}

// Keeps the parent training_programs enrollment's status in sync with lesson
// completion, so points/the leaderboard/everything that already reads
// trainings.status keeps working unchanged once a program gets lessons.
async function recomputeTrainingStatus(supabase: SupabaseClient, memberId: string, programId: string): Promise<void> {
  const { data: lessons } = await supabase.from("training_lessons").select("id").eq("program_id", programId);
  if (!lessons || lessons.length === 0) return; // no lessons yet — legacy single-status flow owns this program

  const lessonIds = lessons.map((l) => l.id);
  const { data: progress } = await supabase
    .from("training_lesson_progress")
    .select("completed")
    .eq("member_id", memberId)
    .in("lesson_id", lessonIds);

  const completedCount = (progress ?? []).filter((p) => p.completed).length;
  const status = completedCount === lessonIds.length ? "completed" : completedCount > 0 ? "in_progress" : "not_started";

  const { data: training } = await supabase
    .from("trainings")
    .select("id, status, completed_at")
    .eq("member_id", memberId)
    .eq("program_id", programId)
    .maybeSingle();
  if (!training || training.status === status) return;

  await supabase
    .from("trainings")
    .update({ status, completed_at: status === "completed" ? (training.completed_at ?? new Date().toISOString()) : null })
    .eq("id", training.id);
}

// ── Learner actions ─────────────────────────────────────────────────────

export async function markLessonComplete(lessonId: string, memberId?: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  const targetMemberId = memberId ?? profile.linkedMemberId;
  if (!targetMemberId) return { ok: false, error: "Not permitted." };

  const supabase = await createClient();
  const { data: lesson } = await supabase.from("training_lessons").select("id, program_id, kind, zone_id").eq("id", lessonId).maybeSingle();
  if (!lesson) return { ok: false, error: "Lesson not found." };
  if (lesson.kind !== "video") return { ok: false, error: "This lesson is a quiz — submit your answers instead." };

  // RLS (training_lesson_progress_insert/_update) is what actually enforces
  // "own row, or staff managing someone in scope" — this just surfaces a
  // clear error instead of a silent 0-row write.
  const { error } = await supabase
    .from("training_lesson_progress")
    .upsert(
      { member_id: targetMemberId, lesson_id: lessonId, zone_id: lesson.zone_id, completed: true, completed_at: new Date().toISOString() },
      { onConflict: "member_id,lesson_id" }
    );
  if (error) return { ok: false, error: error.message };

  await recomputeTrainingStatus(supabase, targetMemberId, lesson.program_id);
  refreshTrainingPages(lesson.program_id);
  return { ok: true };
}

export type QuizResult = { ok: true; score: number; total: number; passed: boolean } | { ok: false; error: string };

// Grading reads the answer key server-side only (service-role client) — a
// learner's own request never carries correct_index anywhere.
export async function submitQuizAttempt(lessonId: string, answers: (number | null)[]): Promise<QuizResult> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.linkedMemberId) return { ok: false, error: "Only a member can take a quiz." };

  const supabase = await createClient();
  const { data: lesson } = await supabase
    .from("training_lessons")
    .select("id, program_id, kind, pass_threshold, zone_id")
    .eq("id", lessonId)
    .maybeSingle();
  if (!lesson || lesson.kind !== "quiz") return { ok: false, error: "Quiz not found." };

  const admin = createAdminClient();
  const { data: questions } = await admin
    .from("training_quiz_questions")
    .select("id, correct_index")
    .eq("lesson_id", lessonId)
    .order("sort_order");
  if (!questions || questions.length === 0) return { ok: false, error: "This quiz has no questions yet." };

  const score = questions.reduce((sum, q, i) => sum + (answers[i] === q.correct_index ? 1 : 0), 0);
  const threshold = lesson.pass_threshold ?? questions.length;
  const passed = score >= threshold;

  const { error } = await supabase.from("training_lesson_progress").upsert(
    {
      member_id: profile.linkedMemberId,
      lesson_id: lessonId,
      zone_id: lesson.zone_id,
      completed: passed,
      completed_at: passed ? new Date().toISOString() : null,
      quiz_score: score,
    },
    { onConflict: "member_id,lesson_id" }
  );
  if (error) return { ok: false, error: error.message };

  await recomputeTrainingStatus(supabase, profile.linkedMemberId, lesson.program_id);
  refreshTrainingPages(lesson.program_id);
  return { ok: true, score, total: questions.length, passed };
}

// ── Authoring (manage_training) ─────────────────────────────────────────

type VideoLessonInput = { title: string; description?: string; videoUrl?: string; durationLabel?: string };
type QuizLessonInput = {
  title: string;
  description?: string;
  passThreshold: number;
  questions: { question: string; options: string[]; correctIndex: number }[];
};

async function requireAuthor(): Promise<{ ok: true; profile: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>> } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_training")) return { ok: false, error: "Not permitted." };
  return { ok: true, profile };
}

type NormalizedQuestion = { question: string; options: string[]; correctIndex: number };

// The editor lets a question have blank trailing (or gapped) option slots.
// Options are stored compacted (blanks removed), so the correct answer's
// INDEX has to be recomputed against that compacted list — reusing q.correctIndex
// as-is after filtering would silently point at the wrong option whenever a
// blank sits before the correct one.
function normalizeQuestions(questions: QuizLessonInput["questions"]): NormalizedQuestion[] | string {
  if (questions.length === 0) return "Add at least one question.";
  const normalized: NormalizedQuestion[] = [];
  for (const q of questions) {
    const questionText = q.question.trim();
    if (!questionText) return "Every question needs text.";
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length) return "Pick which answer is correct for every question.";
    const correctText = q.options[q.correctIndex]?.trim();
    if (!correctText) return "Pick which answer is correct for every question.";

    const options = q.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) return "Every question needs at least two answer choices.";
    const correctIndex = options.indexOf(correctText);
    normalized.push({ question: questionText, options, correctIndex });
  }
  return normalized;
}

async function nextSortOrder(supabase: SupabaseClient, programId: string): Promise<number> {
  const { data } = await supabase.from("training_lessons").select("sort_order").eq("program_id", programId).order("sort_order", { ascending: false }).limit(1);
  return (data?.[0]?.sort_order ?? -1) + 1;
}

export async function createVideoLesson(programId: string, input: VideoLessonInput): Promise<ActionResult> {
  const auth = await requireAuthor();
  if (!auth.ok) return auth;
  if (!input.title.trim()) return { ok: false, error: "A title is required." };

  const supabase = await createClient();
  const sortOrder = await nextSortOrder(supabase, programId);
  const { error } = await supabase.from("training_lessons").insert({
    program_id: programId,
    zone_id: auth.profile.zoneId,
    kind: "video",
    title: input.title.trim(),
    description: input.description?.trim() || null,
    video_url: input.videoUrl?.trim() || null,
    duration_label: input.durationLabel?.trim() || null,
    sort_order: sortOrder,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit(auth.profile, "training_lesson.create", `Added a video lesson "${input.title.trim()}"`);
  refreshTrainingPages(programId);
  return { ok: true };
}

export async function updateVideoLesson(lessonId: string, input: VideoLessonInput): Promise<ActionResult> {
  const auth = await requireAuthor();
  if (!auth.ok) return auth;
  if (!input.title.trim()) return { ok: false, error: "A title is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_lessons")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      video_url: input.videoUrl?.trim() || null,
      duration_label: input.durationLabel?.trim() || null,
    })
    .eq("id", lessonId)
    .select("program_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Lesson not found." };

  await logAudit(auth.profile, "training_lesson.update", `Edited a video lesson "${input.title.trim()}"`);
  refreshTrainingPages(data.program_id);
  return { ok: true };
}

export async function createQuizLesson(programId: string, input: QuizLessonInput): Promise<ActionResult> {
  const auth = await requireAuthor();
  if (!auth.ok) return auth;
  if (!input.title.trim()) return { ok: false, error: "A title is required." };
  const questions = normalizeQuestions(input.questions);
  if (typeof questions === "string") return { ok: false, error: questions };

  const supabase = await createClient();
  const sortOrder = await nextSortOrder(supabase, programId);
  const { data: lesson, error } = await supabase
    .from("training_lessons")
    .insert({
      program_id: programId,
      zone_id: auth.profile.zoneId,
      kind: "quiz",
      title: input.title.trim(),
      description: input.description?.trim() || null,
      pass_threshold: Math.min(input.passThreshold, questions.length),
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !lesson) return { ok: false, error: error?.message ?? "Could not create the quiz." };

  const { error: questionsError } = await supabase.from("training_quiz_questions").insert(
    questions.map((q, i) => ({
      lesson_id: lesson.id,
      zone_id: auth.profile.zoneId,
      question: q.question,
      options: q.options,
      correct_index: q.correctIndex,
      sort_order: i,
    }))
  );
  if (questionsError) {
    await supabase.from("training_lessons").delete().eq("id", lesson.id);
    return { ok: false, error: questionsError.message };
  }

  await logAudit(auth.profile, "training_lesson.create", `Added a quiz "${input.title.trim()}"`);
  refreshTrainingPages(programId);
  return { ok: true };
}

export async function updateQuizLesson(lessonId: string, input: QuizLessonInput): Promise<ActionResult> {
  const auth = await requireAuthor();
  if (!auth.ok) return auth;
  if (!input.title.trim()) return { ok: false, error: "A title is required." };
  const questions = normalizeQuestions(input.questions);
  if (typeof questions === "string") return { ok: false, error: questions };

  const supabase = await createClient();
  const { data: lesson, error } = await supabase
    .from("training_lessons")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      pass_threshold: Math.min(input.passThreshold, questions.length),
    })
    .eq("id", lessonId)
    .select("program_id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!lesson) return { ok: false, error: "Lesson not found." };

  // Simplest correct way to save an edited question set: replace it whole
  // rather than trying to diff/match rows by id.
  await supabase.from("training_quiz_questions").delete().eq("lesson_id", lessonId);
  const { error: questionsError } = await supabase.from("training_quiz_questions").insert(
    questions.map((q, i) => ({
      lesson_id: lessonId,
      zone_id: auth.profile.zoneId,
      question: q.question,
      options: q.options,
      correct_index: q.correctIndex,
      sort_order: i,
    }))
  );
  if (questionsError) return { ok: false, error: questionsError.message };

  await logAudit(auth.profile, "training_lesson.update", `Edited a quiz "${input.title.trim()}"`);
  refreshTrainingPages(lesson.program_id);
  return { ok: true };
}

export async function deleteLesson(lessonId: string): Promise<ActionResult> {
  const auth = await requireAuthor();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data: lesson } = await supabase.from("training_lessons").select("program_id, title").eq("id", lessonId).maybeSingle();
  if (!lesson) return { ok: false, error: "Lesson not found." };

  const { error } = await supabase.from("training_lessons").delete().eq("id", lessonId);
  if (error) return { ok: false, error: error.message };

  await logAudit(auth.profile, "training_lesson.delete", `Deleted the lesson "${lesson.title}"`);
  refreshTrainingPages(lesson.program_id);
  return { ok: true };
}

// Swaps this lesson's position with its neighbor — good enough for a
// handful of lessons per course; no full drag-and-drop reorder needed.
export async function moveLesson(lessonId: string, direction: "up" | "down"): Promise<ActionResult> {
  const auth = await requireAuthor();
  if (!auth.ok) return auth;

  const supabase = await createClient();
  const { data: lesson } = await supabase.from("training_lessons").select("id, program_id, sort_order").eq("id", lessonId).maybeSingle();
  if (!lesson) return { ok: false, error: "Lesson not found." };

  const { data: siblings } = await supabase
    .from("training_lessons")
    .select("id, sort_order")
    .eq("program_id", lesson.program_id)
    .order("sort_order");
  const ordered = siblings ?? [];
  const index = ordered.findIndex((l) => l.id === lessonId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return { ok: true }; // already at an end

  const neighbor = ordered[swapIndex];
  await supabase.from("training_lessons").update({ sort_order: neighbor.sort_order }).eq("id", lesson.id);
  await supabase.from("training_lessons").update({ sort_order: lesson.sort_order }).eq("id", neighbor.id);

  refreshTrainingPages(lesson.program_id);
  return { ok: true };
}

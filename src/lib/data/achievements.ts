import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getQuizQuestionCounts } from "./training-lessons";
import { computeStreak, type Streak } from "@/lib/streak";

export type MemberAchievementStats = {
  lessonsCompleted: number;
  hasPerfectQuizScore: boolean;
  streak: Streak;
};

// Everything badges/streaks need, derived entirely from lesson-progress
// rows that already exist — no separate tracking table. "Active" days are
// exactly the days something was actually completed (a video lesson marked
// done, or a quiz passed), not just a page visit.
export async function getMemberAchievementStats(memberId: string): Promise<MemberAchievementStats> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("training_lesson_progress")
    .select("lesson_id, completed_at, quiz_score")
    .eq("member_id", memberId)
    .eq("completed", true);

  const rows = data ?? [];
  const activeDates = rows.map((r) => r.completed_at).filter((d): d is string => !!d).map((d) => d.slice(0, 10));

  const quizRows = rows.filter((r) => r.quiz_score != null);
  let hasPerfectQuizScore = false;
  if (quizRows.length > 0) {
    const counts = await getQuizQuestionCounts(supabase, quizRows.map((r) => r.lesson_id));
    hasPerfectQuizScore = quizRows.some((r) => counts.get(r.lesson_id) === r.quiz_score);
  }

  return { lessonsCompleted: rows.length, hasPerfectQuizScore, streak: computeStreak(activeDates) };
}

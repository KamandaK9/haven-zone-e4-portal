"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckCircle2, ListChecks, Pencil, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VideoLessonDialog } from "./video-lesson-dialog";
import { QuizLessonDialog } from "./quiz-lesson-dialog";
import { deleteLesson, moveLesson } from "@/lib/actions/training-lessons";
import type { CourseLesson } from "@/lib/data/types";

type EditableQuestion = { question: string; options: string[]; correctIndex: number };

export function LessonListEditor({
  programId,
  lessons,
  quizQuestionsByLesson,
}: {
  programId: string;
  lessons: CourseLesson[];
  quizQuestionsByLesson: Record<string, EditableQuestion[]>;
}) {
  const router = useRouter();
  const [videoDialog, setVideoDialog] = useState<{ open: boolean; lesson?: CourseLesson }>({ open: false });
  const [quizDialog, setQuizDialog] = useState<{ open: boolean; lesson?: CourseLesson }>({ open: false });
  const [deleting, setDeleting] = useState<CourseLesson | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function move(lessonId: string, direction: "up" | "down") {
    setBusyId(lessonId);
    await moveLesson(lessonId, direction);
    setBusyId(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusyId(deleting.id);
    await deleteLesson(deleting.id);
    setBusyId(null);
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {lessons.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg border-dashed">
          No lessons yet — members see the old single-video flow until you add one.
        </p>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson, i) => {
            const Icon = lesson.kind === "quiz" ? ListChecks : Video;
            return (
              <div key={lesson.id} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{lesson.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {lesson.kind === "quiz"
                      ? `Quiz · ${lesson.questionCount ?? 0} question${lesson.questionCount === 1 ? "" : "s"} · pass with ${lesson.passThreshold ?? "—"}`
                      : lesson.durationLabel
                        ? `Video · ${lesson.durationLabel}`
                        : "Video"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === 0 || busyId === lesson.id}
                    onClick={() => move(lesson.id, "up")}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={i === lessons.length - 1 || busyId === lesson.id}
                    onClick={() => move(lesson.id, "down")}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => (lesson.kind === "quiz" ? setQuizDialog({ open: true, lesson }) : setVideoDialog({ open: true, lesson }))}
                    aria-label="Edit lesson"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-600"
                    onClick={() => setDeleting(lesson)}
                    aria-label="Delete lesson"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setVideoDialog({ open: true })}>
          <Video className="h-3.5 w-3.5" /> Add video lesson
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setQuizDialog({ open: true })}>
          <CheckCircle2 className="h-3.5 w-3.5" /> Add quiz
        </Button>
      </div>

      <VideoLessonDialog
        programId={programId}
        lesson={videoDialog.lesson}
        open={videoDialog.open}
        onOpenChange={(open) => setVideoDialog((s) => ({ ...s, open }))}
      />
      <QuizLessonDialog
        programId={programId}
        lesson={quizDialog.lesson}
        initialQuestions={quizDialog.lesson ? quizQuestionsByLesson[quizDialog.lesson.id] : undefined}
        open={quizDialog.open}
        onOpenChange={(open) => setQuizDialog((s) => ({ ...s, open }))}
      />

      <Dialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{deleting?.title}&rdquo;?</DialogTitle>
            <DialogDescription>Any progress members made on this lesson goes with it. This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={busyId === deleting?.id}>
              {busyId === deleting?.id ? "Deleting…" : "Delete lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

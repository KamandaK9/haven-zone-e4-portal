"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createQuizLesson, updateQuizLesson } from "@/lib/actions/training-lessons";
import type { CourseLesson } from "@/lib/data/types";
import { tenant } from "@/tenant";

type EditableQuestion = { question: string; options: string[]; correctIndex: number };

function emptyQuestion(): EditableQuestion {
  return { question: "", options: ["", "", "", ""], correctIndex: 0 };
}

export function QuizLessonDialog({
  programId,
  lesson,
  initialQuestions,
  open,
  onOpenChange,
}: {
  programId: string;
  lesson?: CourseLesson;
  // Prefetched by the server page — the raw question table is
  // manage_training-only, so this dialog never fetches it itself.
  initialQuestions?: EditableQuestion[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const editing = !!lesson;
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [passThreshold, setPassThreshold] = useState(String(lesson?.passThreshold ?? 1));
  const [questions, setQuestions] = useState<EditableQuestion[]>(initialQuestions?.length ? initialQuestions : [emptyQuestion()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle(lesson?.title ?? "");
    setDescription(lesson?.description ?? "");
    setPassThreshold(String(lesson?.passThreshold ?? 1));
    setQuestions(initialQuestions?.length ? initialQuestions : [emptyQuestion()]);
    setError(null);
  }

  function updateQuestion(qi: number, patch: Partial<EditableQuestion>) {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  }
  function updateOption(qi: number, oi: number, value: string) {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    const input = {
      title,
      description: description || undefined,
      passThreshold: Number(passThreshold) || 1,
      questions,
    };
    const result = lesson ? await updateQuizLesson(lesson.id, input) : await createQuizLesson(programId, input);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit quiz" : "New quiz"}</DialogTitle>
          <DialogDescription>Members answer these to pass the course. Pick the correct option for each question.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="quizTitle">Title</Label>
            <Input id="quizTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tenant.lessonExamples.quiz} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quizDescription">Description</Label>
            <Textarea id="quizDescription" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px]" placeholder="optional" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quizThreshold">Correct answers needed to pass</Label>
            <Input
              id="quizThreshold"
              type="number"
              min={1}
              max={questions.length}
              value={passThreshold}
              onChange={(e) => setPassThreshold(e.target.value)}
              className="w-24"
            />
          </div>

          <div className="space-y-4 border-t pt-4">
            {questions.map((q, qi) => (
              <div key={qi} className="space-y-2.5 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2 text-xs font-semibold text-muted-foreground shrink-0">{qi + 1}.</span>
                  <Input
                    value={q.question}
                    onChange={(e) => updateQuestion(qi, { question: e.target.value })}
                    placeholder="Question text"
                    className="flex-1"
                  />
                  {questions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600"
                      onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== qi))}
                      aria-label="Remove question"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-2 pl-6">
                  {q.options.map((option, oi) => (
                    <label key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correctIndex === oi}
                        onChange={() => updateQuestion(qi, { correctIndex: oi })}
                        className="shrink-0"
                        aria-label={`Option ${oi + 1} is correct`}
                      />
                      <Input
                        value={option}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        className="h-8 text-sm"
                      />
                    </label>
                  ))}
                </div>
                <p className="pl-6 text-[11px] text-muted-foreground">Select the radio next to the correct answer.</p>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}>
              <Plus className="h-3.5 w-3.5" /> Add question
            </Button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={busy || !title.trim()}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

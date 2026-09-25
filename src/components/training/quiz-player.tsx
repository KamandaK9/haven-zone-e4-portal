"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitQuizAttempt, type QuizResult } from "@/lib/actions/training-lessons";
import { cn } from "@/lib/utils";
import type { QuizQuestionForLearner } from "@/lib/data/types";

export function QuizPlayer({
  lessonId,
  title,
  passThreshold,
  questions,
  nextHref,
}: {
  lessonId: string;
  title: string;
  passThreshold: number;
  questions: QuizQuestionForLearner[];
  nextHref?: string; // where "Continue" goes once passed
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);

  const allAnswered = answers.every((a) => a !== null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const res = await submitQuizAttempt(lessonId, answers);
    setSubmitting(false);
    if (!res.ok) return setError(res.error);
    setResult(res);
    router.refresh();
  }

  function retake() {
    setAnswers(questions.map(() => null));
    setResult(null);
  }

  if (result?.ok) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center space-y-4">
        <div className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-full", result.passed ? "bg-emerald-100" : "bg-amber-100")}>
          {result.passed ? <CheckCircle2 className="h-7 w-7 text-emerald-600" /> : <XCircle className="h-7 w-7 text-amber-600" />}
        </div>
        <div>
          <p className="text-lg font-semibold">{result.passed ? "Passed!" : "Not quite"}</p>
          <p className="text-sm text-muted-foreground">
            {result.score} of {result.total} correct — pass with {passThreshold}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button type="button" variant="outline" onClick={retake} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Retake quiz
          </Button>
          {result.passed && nextHref && (
            <Button asChild className="gap-1.5">
              <Link href={nextHref}>
                Continue <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Knowledge check</p>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {questions.length} question{questions.length === 1 ? "" : "s"} &middot; pass with {passThreshold}
        </p>
      </div>

      <div className="space-y-5">
        {questions.map((q, qi) => (
          <div key={q.id} className="space-y-2">
            <p className="text-sm font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {q.options.map((option, oi) => {
                const selected = answers[qi] === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      selected ? "border-primary bg-primary/5 text-foreground" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <Button type="button" onClick={submit} disabled={!allAnswered || submitting} className="gap-1.5">
        {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {submitting ? "Submitting…" : "Submit answers"}
      </Button>
    </div>
  );
}

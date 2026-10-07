"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2, Circle, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { dismissGettingStarted, markStepDone } from "@/lib/actions/getting-started";
import { downloadMemberTemplate } from "@/lib/import/member-template";
import type { Step } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

export function GettingStarted({ steps }: { steps: Step[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const done = steps.filter((s) => s.done).length;
  const run = (fn: () => Promise<unknown>) => start(async () => {
    await fn();
    router.refresh();
  });

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            {done} of {steps.length} done — these get everyone up and running.
          </CardDescription>
          <Progress value={(done / steps.length) * 100} className="h-1.5 w-48" />
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(dismissGettingStarted)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Hide this checklist"
          title="Hide this checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent className="divide-y">
        {steps.map((s) => (
          <div key={s.key} className="flex items-start gap-3 py-3">
            {s.done ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", s.done && "text-muted-foreground line-through")}>{s.title}</p>
              {!s.done && <p className="text-xs text-muted-foreground">{s.detail}</p>}
            </div>
            {!s.done && (
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                {s.template === "members" && (
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => downloadMemberTemplate()}>
                    <Download className="h-3.5 w-3.5" /> Template
                  </Button>
                )}
                {s.manual && (
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => markStepDone(s.key))}>
                    Mark done
                  </Button>
                )}
                <Button asChild size="sm" variant="outline">
                  <Link href={s.href}>Go</Link>
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

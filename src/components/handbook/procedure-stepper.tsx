import { Clock, UserRound } from "lucide-react";
import type { ProcedureStep } from "@/lib/handbook/types";

export function ProcedureStepper({ steps }: { steps: ProcedureStep[] }) {
  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span aria-hidden className="absolute left-4 top-9 bottom-1 w-px -translate-x-1/2 bg-border" />}
            <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 space-y-1.5 pt-1">
              <p className="font-medium leading-snug">{step.title}</p>
              {step.detail && <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>}
              {(step.actor || step.deadline) && (
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {step.actor && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                      <UserRound className="h-3 w-3" />
                      {step.actor}
                    </span>
                  )}
                  {step.deadline && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                      <Clock className="h-3 w-3" />
                      {step.deadline}
                    </span>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

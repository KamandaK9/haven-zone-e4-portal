import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_LABELS } from "./types";

export function StepProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {STEP_LABELS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex items-center gap-1.5 sm:gap-2 flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0 transition-colors",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !done && !active && "bg-muted text-muted-foreground"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : step}
              </div>
              <span
                className={cn(
                  "hidden sm:block text-[10px] font-medium text-center leading-tight max-w-[70px]",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {step < STEP_LABELS.length && (
              <div className={cn("h-0.5 flex-1 rounded-full transition-colors", done ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

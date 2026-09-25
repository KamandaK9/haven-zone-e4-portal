import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { TRAINING_ICONS } from "@/lib/training-icons";
import type { LessonStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<LessonStatus, { label: string; className: string }> = {
  completed: { label: "Passed", className: "bg-emerald-50 text-emerald-700" },
  in_progress: { label: "In progress", className: "bg-amber-50 text-amber-700" },
  not_started: { label: "Not started", className: "bg-muted text-muted-foreground" },
};

const ACTION_LABEL: Record<LessonStatus, string> = {
  completed: "Review course",
  in_progress: "Continue",
  not_started: "Start course",
};

// A "bare" course card — icon, name, points, status, one action — that
// opens the real course (its lessons, video and any quiz) at /me/training/[id].
export function TrainingCourseCard({
  programId,
  name,
  description,
  icon,
  points,
  status,
}: {
  programId: string;
  name: string;
  description?: string;
  icon: string;
  points: number;
  status: LessonStatus;
}) {
  const Icon = TRAINING_ICONS[icon] ?? BookOpen;
  const badge = STATUS_BADGE[status];

  return (
    <Link
      href={`/me/training/${programId}`}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0", badge.className)}>{badge.label}</span>
      </div>

      <div className="space-y-1 flex-1">
        <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{name}</p>
        {description && <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-muted-foreground">{points} pts</span>
        <span className="flex items-center gap-1 text-xs font-medium text-primary">
          {status === "completed" ? <CheckCircle2 className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
          {ACTION_LABEL[status]}
        </span>
      </div>
    </Link>
  );
}

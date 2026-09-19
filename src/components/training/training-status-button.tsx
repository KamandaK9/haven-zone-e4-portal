"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateTrainingStatus } from "@/lib/actions/training";
import type { LessonStatus } from "@/lib/data/types";

export function TrainingStatusButton({ trainingId, status }: { trainingId: string; status: LessonStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function set(next: "in_progress" | "completed") {
    setPending(true);
    const result = await updateTrainingStatus(trainingId, next);
    setPending(false);
    if (result.ok) router.refresh();
  }

  if (status === "completed") {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
      </span>
    );
  }

  if (status === "in_progress") {
    return (
      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending} onClick={() => set("completed")}>
        {pending ? "Saving…" : "Mark complete"}
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" className="h-7 text-xs" disabled={pending} onClick={() => set("in_progress")}>
      {pending ? "Saving…" : "Start"}
    </Button>
  );
}

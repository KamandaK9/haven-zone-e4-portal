"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateCohort } from "@/lib/actions/courses";

const NONE = "none";

export function CohortSettings({
  cohortId,
  teacherId,
  closed,
  teachers,
}: {
  cohortId: string;
  teacherId?: string;
  closed: boolean;
  teachers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const save = async (patch: Parameters<typeof updateCohort>[1]) => {
    setBusy(true);
    await updateCohort(cohortId, patch);
    setBusy(false);
    router.refresh();
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={teacherId ?? NONE} onValueChange={(v) => save({ teacherProfileId: v === NONE ? null : v })} disabled={busy}>
        <SelectTrigger className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No teacher</SelectItem>
          {teachers.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              Teacher: {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" disabled={busy} onClick={() => save({ closed: !closed })}>
        {closed ? "Reopen group" : "Mark finished"}
      </Button>
    </div>
  );
}

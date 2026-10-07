"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { setClassAttendance, unenrolMember } from "@/lib/actions/courses";

type Student = { memberId: string; name: string; cell?: string };
type Mark = { classId: string; memberId: string; cohortId: string; date: string };

// A class group's register: one row per student, one column per class. A
// tick from another group (a class taken earlier, or a make-up) shows but
// can only be changed from that group.
export function Register({
  cohortId,
  classes,
  required,
  students,
  marks,
  canEdit,
  canEnrol,
}: {
  cohortId: string;
  classes: { id: string; number: number; title: string }[];
  required: number;
  students: Student[];
  marks: Mark[];
  canEdit: boolean;
  canEnrol: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const markFor = (classId: string, memberId: string) => marks.find((m) => m.classId === classId && m.memberId === memberId);
  const isMarked = (classId: string, memberId: string) =>
    optimistic.get(`${classId}|${memberId}`) ?? !!markFor(classId, memberId);

  function toggle(classId: string, memberId: string) {
    const k = `${classId}|${memberId}`;
    const next = !isMarked(classId, memberId);
    setOptimistic((m) => new Map(m).set(k, next));
    setError(null);
    startTransition(async () => {
      const res = await setClassAttendance(cohortId, classId, memberId, next, date);
      if (!res.ok) {
        setError(res.error);
        setOptimistic((m) => {
          const n = new Map(m);
          n.delete(k);
          return n;
        });
      } else router.refresh();
    });
  }

  if (students.length === 0) {
    return <p className="text-sm text-muted-foreground">No students yet{canEnrol ? " — add some with “Add students”." : "."}</p>;
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="class-date" className="text-xs">
              Ticks are recorded for
            </Label>
            <Input id="class-date" type="date" className="h-8 w-40" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
          {pending && <span className="pb-2 text-xs text-muted-foreground">Saving…</span>}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
              <th className="p-2 text-left font-medium">Student</th>
              {classes.map((c) => (
                <th key={c.id} className="p-2 text-center font-medium" title={c.title || undefined}>
                  {c.number}
                </th>
              ))}
              <th className="p-2 text-right font-medium">Done</th>
              {canEnrol && <th />}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const count = classes.filter((c) => isMarked(c.id, s.memberId)).length;
              return (
                <tr key={s.memberId} className="border-b last:border-0">
                  <td className="p-2">
                    <p className="font-medium">{s.name}</p>
                    {s.cell && <p className="text-xs text-muted-foreground">{s.cell}</p>}
                  </td>
                  {classes.map((c) => {
                    const mark = markFor(c.id, s.memberId);
                    const elsewhere = !!mark && mark.cohortId !== cohortId && !optimistic.has(`${c.id}|${s.memberId}`);
                    const on = isMarked(c.id, s.memberId);
                    return (
                      <td key={c.id} className="p-1 text-center">
                        <button
                          type="button"
                          disabled={!canEdit || elsewhere}
                          onClick={() => toggle(c.id, s.memberId)}
                          title={elsewhere ? `Attended ${mark!.date} in another group` : on && mark ? `Attended ${mark.date}` : undefined}
                          className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors",
                            on ? (elsewhere ? "border-emerald-200 bg-emerald-50 text-emerald-500" : "border-emerald-600 bg-emerald-600 text-white") : "hover:bg-muted",
                            (!canEdit || elsewhere) && "cursor-default"
                          )}
                          aria-label={`Class ${c.number} for ${s.name}`}
                        >
                          {on && <Check className="h-4 w-4" />}
                        </button>
                      </td>
                    );
                  })}
                  <td className="p-2 text-right whitespace-nowrap">
                    {count >= required ? <Badge>Completed</Badge> : <span className="tabular-nums text-muted-foreground">{count}/{required}</span>}
                  </td>
                  {canEnrol && (
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${s.name}`}
                        onClick={() =>
                          startTransition(async () => {
                            const res = await unenrolMember(cohortId, s.memberId);
                            if (!res.ok) setError(res.error);
                            else router.refresh();
                          })
                        }
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Pale ticks were taken in another group (an earlier one, or a make-up).</p>
    </div>
  );
}

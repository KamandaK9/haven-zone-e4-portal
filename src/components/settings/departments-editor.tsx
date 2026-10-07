"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addDepartments, moveDepartment, removeDepartment, renameDepartment } from "@/lib/actions/departments";

export function DepartmentsEditor({
  departments,
  counts,
  suggestions,
}: {
  departments: { id: string; name: string }[];
  counts: Record<string, number>;
  suggestions: readonly string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  const have = new Set(departments.map((d) => d.name.toLowerCase()));
  const missing = suggestions.filter((s) => !have.has(s.toLowerCase()));

  return (
    <div className="space-y-4">
      {departments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No departments yet.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {departments.map((d, i) => (
            <div key={d.id} className="flex items-center gap-2 p-2">
              <Input
                defaultValue={d.name}
                className="h-8 flex-1"
                onBlur={(e) => e.target.value.trim() !== d.name && run(() => renameDepartment(d.id, e.target.value))}
              />
              <span className="w-20 text-right text-xs text-muted-foreground">{counts[d.id] ?? 0} people</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending || i === 0} onClick={() => run(() => moveDepartment(d.id, -1))} aria-label="Move up">
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending || i === departments.length - 1} onClick={() => run(() => moveDepartment(d.id, 1))} aria-label="Move down">
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-700"
                disabled={pending}
                aria-label={`Remove ${d.name}`}
                onClick={() => confirm(`Remove ${d.name}? People stay; they're just no longer listed in it.`) && run(() => removeDepartment(d.id))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => addDepartments([name]));
          setName("");
        }}
      >
        <Input placeholder="New department" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <Button type="submit" variant="outline" className="gap-1.5" disabled={pending || !name.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>
      {missing.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Common ones — tap to add:</p>
          <div className="flex flex-wrap gap-2">
            {missing.map((s) => (
              <button key={s} type="button" disabled={pending} onClick={() => run(() => addDepartments([s]))} className="rounded-full border px-3 py-1 text-xs hover:bg-muted">
                + {s}
              </button>
            ))}
            {missing.length > 1 && (
              <button type="button" disabled={pending} onClick={() => run(() => addDepartments([...missing]))} className="rounded-full border border-primary px-3 py-1 text-xs text-primary hover:bg-primary/5">
                Add all
              </button>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { enrolMembers } from "@/lib/actions/courses";

export function EnrolDialog({
  cohortId,
  candidates,
}: {
  cohortId: string;
  // Members of the group's sub-group not already in it; `done` = completed the course.
  candidates: { id: string; name: string; cell?: string; done: boolean; firstTimer: boolean }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return candidates.filter((c) => words.every((w) => c.name.toLowerCase().includes(w))).slice(0, 100);
  }, [candidates, query]);

  async function save() {
    setBusy(true);
    const res = await enrolMembers(cohortId, [...picked]);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setPicked(new Set());
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" /> Add students
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add students</DialogTitle>
          <DialogDescription>First-timers are listed first — they&apos;re who usually starts next.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search members…" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border divide-y">
          {shown.length === 0 && <p className="p-3 text-sm text-muted-foreground">No one to add.</p>}
          {shown.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 p-2.5 text-sm hover:bg-muted/50">
              <Checkbox
                checked={picked.has(c.id)}
                onCheckedChange={(v) =>
                  setPicked((p) => {
                    const n = new Set(p);
                    if (v) n.add(c.id);
                    else n.delete(c.id);
                    return n;
                  })
                }
              />
              <span className="flex-1">
                {c.name}
                <span className="block text-xs text-muted-foreground">
                  {[c.cell, c.firstTimer ? "First-timer" : null, c.done ? "Already completed" : null].filter(Boolean).join(" · ") || " "}
                </span>
              </span>
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || picked.size === 0}>
            {busy ? "Adding…" : `Add ${picked.size || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

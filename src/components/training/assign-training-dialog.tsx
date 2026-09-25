"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignTraining } from "@/lib/actions/training";
import type { Country, Church, TrainingProgram } from "@/lib/data/types";

export function AssignTrainingDialog({
  program,
  countries,
  churches,
}: {
  program: TrainingProgram;
  countries: Country[];
  churches: Church[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("zone");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<{ added: number; alreadyHad: number } | null>(null);

  function reset() {
    setScope("zone");
    setError(null);
    setAssigned(null);
  }

  async function handleAssign() {
    setSubmitting(true);
    setError(null);

    const [type, id] = scope.split(":");
    const result = await assignTraining(
      program.id,
      type === "country" ? { type: "country", countryId: id } : type === "church" ? { type: "church", churchId: id } : { type: "zone" }
    );

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAssigned({ added: result.assigned, alreadyHad: result.alreadyHad });
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Users2 className="h-3.5 w-3.5" />
          Assign
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign &quot;{program.name}&quot;</DialogTitle>
          <DialogDescription>Choose who this training goes to. Members already assigned are skipped.</DialogDescription>
        </DialogHeader>

        {assigned !== null ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="rounded-full bg-emerald-100 p-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {assigned.added > 0
                  ? `Assigned to ${assigned.added.toLocaleString()} member${assigned.added === 1 ? "" : "s"}`
                  : assigned.alreadyHad > 0
                    ? "Nothing new to assign"
                    : "No members found in that group"}
              </p>
              {assigned.alreadyHad > 0 && (
                <p className="text-xs text-muted-foreground">
                  {assigned.added > 0
                    ? `${assigned.alreadyHad.toLocaleString()} already had it.`
                    : `Everyone in this group (${assigned.alreadyHad.toLocaleString()}) already has this training.`}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="py-2">
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zone">Entire zone</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={`country:${c.id}`}>
                    {c.flag} {c.name} — all churches
                  </SelectItem>
                ))}
                {churches.map((c) => (
                  <SelectItem key={c.id} value={`church:${c.id}`}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {assigned !== null ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={submitting}>
                {submitting ? "Assigning…" : "Assign"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

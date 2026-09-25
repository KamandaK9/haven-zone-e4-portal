"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ProgramFormDialog } from "./create-program-dialog";
import { deleteTrainingProgram } from "@/lib/actions/training";
import type { TrainingProgram } from "@/lib/data/types";

export function ProgramCardMenu({
  program,
  assigned,
  completed,
}: {
  program: TrainingProgram;
  assigned: number;
  completed: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteTrainingProgram(program.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDeleting(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1" aria-label={`Options for ${program.name}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => {
              setError(null);
              setDeleting(true);
            }}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProgramFormDialog program={program} open={editing} onOpenChange={setEditing} />

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete &ldquo;{program.name}&rdquo;?</DialogTitle>
            <DialogDescription>
              {assigned > 0
                ? `This removes it from ${assigned.toLocaleString()} member${assigned === 1 ? "" : "s"}' progress (${completed.toLocaleString()} completed) and takes back the ${program.points} points each completion earned. `
                : "No one is assigned to it yet. "}
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={confirmDelete} disabled={busy}>
              {busy ? "Deleting…" : "Delete program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

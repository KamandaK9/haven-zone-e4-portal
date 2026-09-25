"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTrainingProgram, updateTrainingProgram } from "@/lib/actions/training";
import { TRAINING_ICON_OPTIONS, getTrainingIcon } from "@/lib/training-icons";
import type { TrainingProgram } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { tenant } from "@/tenant";

// One form for both creating a program and editing an existing one. Controlled
// (open/onOpenChange) so the card menu can open it for Edit.
export function ProgramFormDialog({
  program,
  open,
  onOpenChange,
}: {
  program?: TrainingProgram;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const editing = !!program;
  const [name, setName] = useState(program?.name ?? "");
  const [description, setDescription] = useState(program?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(program?.videoUrl ?? "");
  const [icon, setIcon] = useState(program?.icon ?? TRAINING_ICON_OPTIONS[0]);
  const [points, setPoints] = useState(String(program?.points ?? 10));
  const [assignToNewMembers, setAssignToNewMembers] = useState(program?.assignToNewMembers ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName(program?.name ?? "");
    setDescription(program?.description ?? "");
    setVideoUrl(program?.videoUrl ?? "");
    setIcon(program?.icon ?? TRAINING_ICON_OPTIONS[0]);
    setPoints(String(program?.points ?? 10));
    setAssignToNewMembers(program?.assignToNewMembers ?? false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const input = {
      name,
      description: description || undefined,
      videoUrl: videoUrl || undefined,
      icon,
      points: Number(points),
      assignToNewMembers,
    };
    const result = program ? await updateTrainingProgram(program.id, input) : await createTrainingProgram(input);

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    onOpenChange(false);
    if (!editing) reset();
    setSubmitting(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit training program" : "New training program"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Changes apply to everyone assigned to it. Changing the points updates every member's total, including points they've already earned."
                : "Optionally link a video members can watch as part of it."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="programName">Name</Label>
              <Input id="programName" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Financial Stewardship" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="programDescription">Description</Label>
              <Textarea
                id="programDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="optional"
                className="min-h-[70px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="videoUrl">Video link</Label>
              <Input
                id="videoUrl"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder={`optional — ${tenant.lessonExamples.videoHosts}`}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="points">Points on completion</Label>
              <Input id="points" type="number" min="1" step="1" value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="grid grid-cols-9 gap-1.5">
                {TRAINING_ICON_OPTIONS.map((iconName) => {
                  const Icon = getTrainingIcon(iconName);
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setIcon(iconName)}
                      className={cn(
                        "flex items-center justify-center rounded-lg border p-2 transition-colors",
                        icon === iconName ? "border-primary bg-accent text-primary" : "border-border hover:bg-muted/50"
                      )}
                      aria-label={iconName}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <Checkbox
                checked={assignToNewMembers}
                onCheckedChange={(v) => setAssignToNewMembers(v === true)}
                className="mt-0.5"
              />
              <span>
                Assign to new members automatically
                <span className="block text-xs text-muted-foreground">
                  Anyone added or imported from now on is enrolled in this program.
                </span>
              </span>
            </label>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Saving…" : editing ? "Save changes" : "Create program"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreateProgramDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New program
      </Button>
      <ProgramFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

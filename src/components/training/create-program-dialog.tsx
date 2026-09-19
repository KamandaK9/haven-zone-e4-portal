"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTrainingProgram } from "@/lib/actions/training";
import { TRAINING_ICON_OPTIONS, getTrainingIcon } from "@/lib/training-icons";
import { cn } from "@/lib/utils";

export function CreateProgramDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [icon, setIcon] = useState(TRAINING_ICON_OPTIONS[0]);
  const [points, setPoints] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setDescription("");
    setVideoUrl("");
    setIcon(TRAINING_ICON_OPTIONS[0]);
    setPoints("10");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createTrainingProgram({
      name,
      description: description || undefined,
      videoUrl: videoUrl || undefined,
      icon,
      points: Number(points),
    });

    if (!result.ok) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setOpen(false);
    reset();
    setSubmitting(false);
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
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New program
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New training program</DialogTitle>
            <DialogDescription>Optionally link a video members can watch as part of it.</DialogDescription>
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
                placeholder="optional — YouTube, Vimeo, KingsChat, etc."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="points">Points on completion</Label>
              <Input id="points" type="number" min="1" step="1" value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="grid grid-cols-9 gap-1.5">
                {TRAINING_ICON_OPTIONS.map((name) => {
                  const Icon = getTrainingIcon(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setIcon(name)}
                      className={cn(
                        "flex items-center justify-center rounded-lg border p-2 transition-colors",
                        icon === name ? "border-primary bg-accent text-primary" : "border-border hover:bg-muted/50"
                      )}
                      aria-label={name}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create program"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

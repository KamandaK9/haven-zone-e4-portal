"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
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
} from "@/components/ui/dialog";
import { createVideoLesson, updateVideoLesson } from "@/lib/actions/training-lessons";
import type { CourseLesson } from "@/lib/data/types";
import { tenant } from "@/tenant";

export function VideoLessonDialog({
  programId,
  lesson,
  open,
  onOpenChange,
}: {
  programId: string;
  lesson?: CourseLesson;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const editing = !!lesson;
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? "");
  const [durationLabel, setDurationLabel] = useState(lesson?.durationLabel ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle(lesson?.title ?? "");
    setDescription(lesson?.description ?? "");
    setVideoUrl(lesson?.videoUrl ?? "");
    setDurationLabel(lesson?.durationLabel ?? "");
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const input = { title, description: description || undefined, videoUrl: videoUrl || undefined, durationLabel: durationLabel || undefined };
    const result = lesson ? await updateVideoLesson(lesson.id, input) : await createVideoLesson(programId, input);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onOpenChange(false);
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
        <DialogHeader>
          <DialogTitle>{editing ? "Edit video lesson" : "New video lesson"}</DialogTitle>
          <DialogDescription>A single video with a title and description members watch, then mark complete.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lessonTitle">Title</Label>
            <Input id="lessonTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tenant.lessonExamples.video} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lessonDescription">Description</Label>
            <Textarea id="lessonDescription" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[70px]" placeholder="optional" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lessonVideo">Video link</Label>
            <Input id="lessonVideo" type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder={tenant.lessonExamples.videoHosts} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lessonDuration">Duration (optional)</Label>
            <Input id="lessonDuration" value={durationLabel} onChange={(e) => setDurationLabel(e.target.value)} placeholder="e.g. 4:12" className="w-28" />
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={busy || !title.trim()}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add lesson"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

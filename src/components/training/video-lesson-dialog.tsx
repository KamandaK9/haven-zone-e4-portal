"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Circle, Loader2, UploadCloud, Video } from "lucide-react";
import * as UpChunk from "@mux/upchunk";
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
import {
  createLessonVideoUpload,
  createVideoLesson,
  refreshLessonVideo,
  removeLessonVideo,
  updateVideoLesson,
} from "@/lib/actions/training-lessons";
import type { LessonVideoStatus } from "@/lib/supabase/types";
import type { UploadTarget } from "@/lib/video/provider";
import { canRecord } from "@/lib/video/recording";
import { formatDuration } from "@/lib/video/watch";
import { LessonRecorder } from "./lesson-recorder";
import type { CourseLesson } from "@/lib/data/types";
import { tenant } from "@/tenant";

// Sends the file straight to the video host, in whatever way the host's
// upload target asks for.
function uploadFile(target: UploadTarget, file: File, onProgress: (pct: number) => void): Promise<void> {
  switch (target.protocol) {
    case "chunked-put":
      return uploadChunked(target.url, file, onProgress);
  }
}

// Resumable chunks — a dropped connection retries the current chunk
// instead of starting over.
function uploadChunked(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = UpChunk.createUpload({ endpoint: url, file, chunkSize: 5120 }); // KB
    upload.on("progress", (e) => onProgress(Math.round(e.detail as number)));
    upload.on("success", () => resolve());
    upload.on("error", (e) => reject(new Error((e.detail as { message?: string })?.message ?? "Upload failed.")));
  });
}

const STATUS_LABEL: Record<LessonVideoStatus, string> = {
  uploading: "Uploading…",
  processing: "Processing — usually a few minutes",
  ready: "Ready",
  errored: "Processing failed — upload it again",
};

export function VideoLessonDialog({
  programId,
  lesson,
  open,
  onOpenChange,
  hostedVideoEnabled,
}: {
  programId: string;
  lesson?: CourseLesson;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Whether this deployment has a video host configured (MUX_* env vars).
  hostedVideoEnabled: boolean;
}) {
  const router = useRouter();
  const editing = !!lesson;
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? "");
  const [durationLabel, setDurationLabel] = useState(lesson?.durationLabel ?? "");
  const [file, setFile] = useState<File | null>(null);
  // In-portal recording: the recorder is showing / holds a live take, and
  // the length of a finished take waiting to be saved.
  const [recording, setRecording] = useState(false);
  const [recorderBusy, setRecorderBusy] = useState(false);
  const [recordedSeconds, setRecordedSeconds] = useState<number | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [videoStatus, setVideoStatus] = useState<LessonVideoStatus | null>(lesson?.hostedVideo?.status ?? null);
  // Set once a new lesson has been created, so retrying a failed upload
  // updates it instead of creating a duplicate.
  const [createdLessonId, setCreatedLessonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploading = uploadPct !== null;

  function reset() {
    setTitle(lesson?.title ?? "");
    setDescription(lesson?.description ?? "");
    setVideoUrl(lesson?.videoUrl ?? "");
    setDurationLabel(lesson?.durationLabel ?? "");
    setFile(null);
    setRecording(false);
    setRecorderBusy(false);
    setRecordedSeconds(null);
    setUploadPct(null);
    setVideoStatus(lesson?.hostedVideo?.status ?? null);
    setCreatedLessonId(null);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const input = { title, description: description || undefined, videoUrl: videoUrl || undefined, durationLabel: durationLabel || undefined };
    let lessonId: string;
    const existingId = lesson?.id ?? createdLessonId;
    if (existingId) {
      const result = await updateVideoLesson(existingId, input);
      if (!result.ok) {
        setBusy(false);
        return setError(result.error);
      }
      lessonId = existingId;
    } else {
      const result = await createVideoLesson(programId, input);
      if (!result.ok) {
        setBusy(false);
        return setError(result.error);
      }
      lessonId = result.lessonId;
      setCreatedLessonId(lessonId);
    }

    if (file) {
      const started = await createLessonVideoUpload(lessonId);
      if (!started.ok) {
        setBusy(false);
        router.refresh();
        return setError(`Lesson saved, but the upload couldn't start: ${started.error}`);
      }
      setUploadPct(0);
      try {
        await uploadFile(started.target, file, setUploadPct);
      } catch (e) {
        setBusy(false);
        setUploadPct(null);
        router.refresh();
        return setError(`Lesson saved, but the upload failed: ${e instanceof Error ? e.message : "unknown error"}. Try again.`);
      }
      setUploadPct(null);
    }

    setBusy(false);
    onOpenChange(false);
    reset();
    router.refresh();
  }

  async function checkStatus() {
    if (!lesson) return;
    setBusy(true);
    const result = await refreshLessonVideo(lesson.id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setVideoStatus(result.status);
    router.refresh();
  }

  async function removeVideo() {
    if (!lesson) return;
    setBusy(true);
    const result = await removeLessonVideo(lesson.id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setVideoStatus(null);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        // Closing now would abandon an upload or a live recording.
        if (uploading || recorderBusy) return;
        if (!v && recordedSeconds !== null && !window.confirm("Discard your recording? It hasn't been saved.")) return;
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className={recording ? "sm:max-w-2xl" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit video lesson" : "New video lesson"}</DialogTitle>
          <DialogDescription>
            {hostedVideoEnabled
              ? "A single video members watch. Uploaded videos complete automatically once watched; linked videos are marked complete by the member."
              : "A single video with a title and description members watch, then mark complete."}
          </DialogDescription>
        </DialogHeader>
        {recording ? (
          <LessonRecorder
            onBusyChange={setRecorderBusy}
            onCancel={() => {
              setRecorderBusy(false);
              setRecording(false);
            }}
            onComplete={(recorded, seconds) => {
              setFile(recorded);
              setRecordedSeconds(seconds);
              setRecorderBusy(false);
              setRecording(false);
            }}
          />
        ) : (
        <>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="lessonTitle">Title</Label>
            <Input id="lessonTitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tenant.lessonExamples.video} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lessonDescription">Description</Label>
            <Textarea id="lessonDescription" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[70px]" placeholder="optional" />
          </div>
          {hostedVideoEnabled && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="lessonUpload">Uploaded video</Label>
              {videoStatus && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {videoStatus === "ready" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : videoStatus === "errored" ? (
                    <AlertCircle className="h-3.5 w-3.5 text-red-600" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  )}
                  <span>
                    {STATUS_LABEL[videoStatus]}
                    {videoStatus === "ready" && lesson?.hostedVideo?.durationSeconds
                      ? ` · ${formatDuration(lesson.hostedVideo.durationSeconds)}`
                      : ""}
                  </span>
                  {(videoStatus === "uploading" || videoStatus === "processing") && (
                    <button type="button" onClick={checkStatus} disabled={busy} className="text-primary font-medium hover:underline">
                      Check status
                    </button>
                  )}
                  <button type="button" onClick={removeVideo} disabled={busy} className="text-red-600 font-medium hover:underline ml-auto">
                    Remove
                  </button>
                </div>
              )}
              {recordedSeconds !== null ? (
                <div className="flex items-center gap-2 rounded-md bg-primary/5 px-2.5 py-2 text-xs">
                  <Video className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">Recording ready · {formatDuration(recordedSeconds)}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setFile(null);
                      setRecordedSeconds(null);
                    }}
                    className="ml-auto text-red-600 font-medium hover:underline"
                  >
                    Discard
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    id="lessonUpload"
                    type="file"
                    accept="video/*"
                    disabled={busy}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="flex-1"
                  />
                  {canRecord() && (
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setRecording(true)} className="gap-1.5 shrink-0">
                      <Circle className="h-3 w-3 fill-red-500 text-red-500" /> Record
                    </Button>
                  )}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {videoStatus
                  ? "A new file or recording replaces the current video when you save."
                  : "Upload a file or record one here. It uploads when you save, streams privately to signed-in members, and gets auto-generated captions."}
              </p>
              {uploading && (
                <div className="space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    <UploadCloud className="inline h-3 w-3 mr-1" />
                    Uploading {uploadPct}% — keep this window open
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="lessonVideo">{hostedVideoEnabled ? "Or a video link" : "Video link"}</Label>
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
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (recordedSeconds !== null && !window.confirm("Discard your recording? It hasn't been saved.")) return;
              onOpenChange(false);
              reset();
            }}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={busy || !title.trim()}>
            {uploading ? "Uploading…" : busy ? "Saving…" : editing ? "Save changes" : "Add lesson"}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}

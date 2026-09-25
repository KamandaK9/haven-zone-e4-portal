"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertCircle, FileText, ImagePlus, Link2, Loader2, Pencil, Trash2, Upload, X } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";
import {
  addEventMedia,
  createSeriesEdition,
  createUploadToken,
  deleteEventPage,
  removeEventCover,
  removeEventMedia,
  setEventCover,
  updateEventPage,
  updateSeriesPage,
} from "@/lib/actions/events";
import { EVENT_MEDIA_BUCKET, FILE_TYPES, IMAGE_TYPES } from "@/lib/event-media";
import type { CalendarEvent, EventMedia, EventSeries } from "@/lib/data/types";

type Busy = "save" | "cover" | "images" | "files" | "video" | "delete" | null;

// Uploads straight from the browser to storage using a token the server
// issued after checking permission, then records the result.
async function uploadToStorage(
  eventId: string,
  file: File,
  kind: "image" | "file"
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const token = await createUploadToken(eventId, { name: file.name, type: file.type, size: file.size, kind });
  if (!token.ok) return token;
  const { error } = await createClient()
    .storage.from(EVENT_MEDIA_BUCKET)
    .uploadToSignedUrl(token.path, token.token, file, { contentType: file.type });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path: token.path };
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {message}
    </div>
  );
}

export function EventEditorButton({
  event,
  media,
  defaultOpen = false,
  afterDeleteHref,
}: {
  event: CalendarEvent;
  media: EventMedia[];
  defaultOpen?: boolean;
  afterDeleteHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date);
  const [endDate, setEndDate] = useState(event.endDate ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const images = media.filter((m) => m.kind === "image");
  const files = media.filter((m) => m.kind === "file");
  const videos = media.filter((m) => m.kind === "video");

  async function save() {
    setBusy("save");
    setError(null);
    const result = await updateEventPage(event.id, { title, date, endDate: endDate || undefined, location, description });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  async function uploadCover(file: File) {
    setBusy("cover");
    setError(null);
    const uploaded = await uploadToStorage(event.id, file, "image");
    const result = uploaded.ok ? await setEventCover(event.id, uploaded.path) : uploaded;
    setBusy(null);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  async function uploadMany(list: FileList, kind: "image" | "file") {
    setBusy(kind === "image" ? "images" : "files");
    setError(null);
    const problems: string[] = [];
    for (const file of Array.from(list)) {
      const uploaded = await uploadToStorage(event.id, file, kind);
      const result = uploaded.ok
        ? await addEventMedia(event.id, { kind, path: uploaded.path, title: kind === "file" ? file.name : undefined })
        : uploaded;
      if (!result.ok) problems.push(`${file.name}: ${result.error}`);
    }
    setBusy(null);
    if (problems.length > 0) setError(problems.join(" "));
    router.refresh();
  }

  async function addVideo() {
    setBusy("video");
    setError(null);
    const result = await addEventMedia(event.id, { kind: "video", url: videoUrl, title: videoTitle });
    setBusy(null);
    if (!result.ok) return setError(result.error);
    setVideoUrl("");
    setVideoTitle("");
    router.refresh();
  }

  async function remove(mediaId: string) {
    setError(null);
    const result = await removeEventMedia(mediaId);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  async function removeCover() {
    setError(null);
    const result = await removeEventCover(event.id);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  async function deleteEvent() {
    setBusy("delete");
    const result = await deleteEventPage(event.id);
    if (!result.ok) {
      setBusy(null);
      return setError(result.error);
    }
    router.push(afterDeleteHref);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Edit page
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit event page</DialogTitle>
            <DialogDescription>
              Pictures, resources and videos apply as soon as they&apos;re added. Details below are saved with the
              button at the bottom.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <section className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="evTitle">Title</Label>
                <Input id="evTitle" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="evStart">Starts</Label>
                  <Input id="evStart" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evEnd">Ends (optional)</Label>
                  <Input id="evEnd" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evLocation">Location</Label>
                <Input id="evLocation" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Johannesburg, South Africa" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="evDescription">What this event was about</Label>
                <Textarea
                  id="evDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[140px]"
                  placeholder="Describe the event — the theme, what happened, who took part."
                />
              </div>
            </section>

            <section className="space-y-2">
              <Label>Cover picture</Label>
              <div className="flex items-center gap-3">
                {event.coverUrl ? (
                  <div className="relative h-16 w-28 overflow-hidden rounded-lg bg-muted shrink-0">
                    <Image src={event.coverUrl} alt="" fill sizes="112px" className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground shrink-0">
                    None
                  </div>
                )}
                <input
                  ref={coverInput}
                  type="file"
                  accept={IMAGE_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) uploadCover(f);
                  }}
                />
                <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => coverInput.current?.click()} className="gap-1.5">
                  {busy === "cover" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {event.coverUrl ? "Replace" : "Upload"}
                </Button>
                {event.coverUrl && (
                  <Button type="button" size="sm" variant="ghost" onClick={removeCover} disabled={busy !== null}>
                    Remove
                  </Button>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Pictures ({images.length})</Label>
                <input
                  ref={imageInput}
                  type="file"
                  multiple
                  accept={IMAGE_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const list = e.target.files;
                    if (list && list.length > 0) uploadMany(list, "image");
                    e.target.value = "";
                  }}
                />
                <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => imageInput.current?.click()} className="gap-1.5">
                  {busy === "images" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  Add pictures
                </Button>
              </div>
              {images.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {images.map((img) => (
                    <div key={img.id} className="relative aspect-square overflow-hidden rounded-lg bg-muted group">
                      <Image src={img.url} alt="" fill sizes="120px" className="object-cover" />
                      <button
                        type="button"
                        onClick={() => remove(img.id)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        aria-label="Remove picture"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Resources ({files.length})</Label>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={FILE_TYPES.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const list = e.target.files;
                    if (list && list.length > 0) uploadMany(list, "file");
                    e.target.value = "";
                  }}
                />
                <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => fileInput.current?.click()} className="gap-1.5">
                  {busy === "files" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  Add files
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">PDF, Word, PowerPoint or Excel — up to 25 MB each.</p>
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{f.title || "File"}</span>
                  <button type="button" onClick={() => remove(f.id)} className="text-muted-foreground hover:text-red-600" aria-label="Remove file">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <Label>Videos ({videos.length})</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="YouTube or Vimeo link" type="url" className="flex-1" />
                <Input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="Title (optional)" className="sm:w-44" />
                <Button type="button" size="sm" variant="outline" disabled={busy !== null || !videoUrl.trim()} onClick={addVideo} className="gap-1.5 h-8">
                  {busy === "video" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                  Add
                </Button>
              </div>
              {videos.map((v) => (
                <div key={v.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{v.title || v.url}</span>
                  <button type="button" onClick={() => remove(v.id)} className="text-muted-foreground hover:text-red-600" aria-label="Remove video">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </section>

            {error && <ErrorNote message={error} />}

            <section className="border-t pt-4">
              {confirmDelete ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-red-700">Delete this event and all its pictures and files?</span>
                  <Button type="button" size="sm" variant="destructive" onClick={deleteEvent} disabled={busy === "delete"}>
                    {busy === "delete" ? "Deleting…" : "Yes, delete"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Keep it
                  </Button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="ghost" className="gap-1.5 text-red-600 hover:text-red-600" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete event
                </Button>
              )}
            </section>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" onClick={save} disabled={busy !== null || !title.trim() || !date}>
              {busy === "save" ? "Saving…" : "Save details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AddEditionButton({ series }: { series: EventSeries }) {
  const router = useRouter();
  const year = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`${series.name} ${year}`);
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const result = await createSeriesEdition(series.id, { title, date, endDate: endDate || undefined, location });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.push(`/event/${result.eventId}?edit=1`);
  }

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <ImagePlus className="h-3.5 w-3.5" /> Add an edition
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New {series.name}</DialogTitle>
            <DialogDescription>Add a year&apos;s edition. You can add the description, pictures and videos next.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edTitle">Title</Label>
              <Input id="edTitle" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edStart">Starts</Label>
                <Input id="edStart" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edEnd">Ends (optional)</Label>
                <Input id="edEnd" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edLocation">Location</Label>
              <Input id="edLocation" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            {error && <ErrorNote message={error} />}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={create} disabled={busy || !title.trim() || !date}>
              {busy ? "Creating…" : "Create edition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SeriesEditorButton({ series }: { series: EventSeries }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(series.name);
  const [description, setDescription] = useState(series.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await updateSeriesPage(series.id, { name, description });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Edit overview
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit overview</DialogTitle>
            <DialogDescription>What this yearly event is, shown at the top of its page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="srName">Name</Label>
              <Input id="srName" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="srDescription">Description</Label>
              <Textarea id="srDescription" value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[120px]" />
            </div>
            {error && <ErrorNote message={error} />}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={busy || !name.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

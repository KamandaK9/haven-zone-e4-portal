"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { createMaterialUpload, deleteMaterial, saveMaterial } from "@/lib/actions/children";
import { RESOURCES_BUCKET } from "@/lib/resources/bucket";

// The head of children's church adds a lesson or resource for the teachers.
export function UploadMaterialDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function save() {
    setBusy(true);
    setError(null);
    let uploaded: { path: string; fileName: string; mime: string; bytes: number } | undefined;
    if (mode === "file" && file) {
      const mime = file.type || "application/octet-stream";
      const token = await createMaterialUpload({ name: file.name, size: file.size });
      if (!token.ok) {
        setBusy(false);
        return setError(token.error);
      }
      const { error: upErr } = await createClient().storage.from(RESOURCES_BUCKET).uploadToSignedUrl(token.path, token.token, file, { contentType: mime });
      if (upErr) {
        setBusy(false);
        return setError(upErr.message);
      }
      uploaded = { path: token.path, fileName: file.name, mime, bytes: file.size };
    }
    const res = await saveMaterial({ title, description, lessonDate, file: uploaded, link: mode === "link" ? link : undefined });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setFile(null);
    setLink("");
    setTitle("");
    setDescription("");
    setLessonDate("");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setError(null);
      }}
    >
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Upload
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a lesson or resource</DialogTitle>
          <DialogDescription>For the children&apos;s church teachers — PDFs, slides, worksheets, pictures, audio and video. Files can be up to 50 MB; for longer videos, link to them instead.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm" role="tablist">
            {(["file", "link"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 font-medium ${mode === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                {m === "file" ? "Upload a file" : "Link a video or slides"}
              </button>
            ))}
          </div>
          <input
            ref={input}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
            }}
          />
          {mode === "file" ? (
            <Button type="button" variant="outline" className="w-full" onClick={() => input.current?.click()}>
              {file ? file.name : "Choose a file"}
            </Button>
          ) : (
            <div className="space-y-1">
              <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtube.com/…" aria-label="Link" />
              <p className="text-xs text-muted-foreground">YouTube, Vimeo, Google Slides or Drive — best for long videos.</p>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="mat-title">Title</Label>
            <Input id="mat-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Week 3 — David and Goliath" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mat-date">For the Sunday of (optional)</Label>
            <Input id="mat-date" type="date" value={lessonDate} onChange={(e) => setLessonDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mat-desc">Notes for the teachers (optional)</Label>
            <Textarea id="mat-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !title.trim() || (mode === "file" ? !file : !link.trim())}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteMaterialButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label={`Remove ${title}`}
      className="text-muted-foreground hover:text-destructive"
      onClick={async () => {
        if (!confirm(`Remove "${title}" from the materials?`)) return;
        await deleteMaterial(id);
        router.refresh();
      }}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

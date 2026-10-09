"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { addClassMaterial, createClassMaterialUpload, removeClassMaterial } from "@/lib/actions/class-materials";
import { CLASS_MATERIALS_BUCKET } from "@/lib/courses/materials-bucket";

export type MaterialView = { id: string; classId: string; title: string; href: string; kind: "file" | "link" };

// A class's materials: open/download for teachers; add and remove for
// whoever manages the course.
export function ClassMaterials({ classId, className, materials, canEdit }: { classId: string; className: string; materials: MaterialView[]; canEdit: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function save() {
    setBusy(true);
    setError(null);
    let uploaded: { path: string; name: string; mime: string; bytes: number } | undefined;
    if (file) {
      const token = await createClassMaterialUpload({ name: file.name, size: file.size });
      if (!token.ok) {
        setBusy(false);
        return setError(token.error);
      }
      const mime = file.type || "application/octet-stream";
      const { error: upErr } = await createClient().storage.from(CLASS_MATERIALS_BUCKET).uploadToSignedUrl(token.path, token.token, file, { contentType: mime });
      if (upErr) {
        setBusy(false);
        return setError(upErr.message);
      }
      uploaded = { path: token.path, name: file.name, mime, bytes: file.size };
    }
    const res = await addClassMaterial({ classId, title, url: uploaded ? undefined : url, file: uploaded });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setTitle("");
    setUrl("");
    setFile(null);
    router.refresh();
  }

  return (
    <div className="space-y-1">
      {materials.map((m) => (
        <div key={m.id} className="flex items-center gap-2 text-sm">
          {m.kind === "file" ? <FileText className="h-3.5 w-3.5 text-muted-foreground" /> : <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
          <a href={m.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {m.title}
          </a>
          {canEdit && (
            <button
              type="button"
              className="ml-auto text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${m.title}`}
              onClick={async () => {
                if (!confirm(`Remove "${m.title}"?`)) return;
                await removeClassMaterial(m.id);
                router.refresh();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
      {materials.length === 0 && !canEdit && <p className="text-xs text-muted-foreground">No materials yet.</p>}
      {canEdit && (
        <button type="button" className="flex items-center gap-1 text-xs text-primary hover:underline" onClick={() => { setError(null); setOpen(true); }}>
          <Plus className="h-3 w-3" /> Add material
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add material — {className}</DialogTitle>
            <DialogDescription>Every teacher of the course can open it. Upload the manual or slides, or link to a video or document.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="mat-title">Title</Label>
              <Input id="mat-title" placeholder="e.g. Class manual" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <input
              ref={input}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.mp3,.mp4"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
              }}
            />
            <Button type="button" variant="outline" className="w-full gap-2" onClick={() => input.current?.click()}>
              <Paperclip className="h-4 w-4" /> {file ? file.name : "Upload a file (PDF, Word, slides…)"}
            </Button>
            {!file && (
              <div className="space-y-1">
                <Label htmlFor="mat-url">…or a link</Label>
                <Input id="mat-url" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || !title.trim() || (!file && !url.trim())}>{busy ? "Adding…" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

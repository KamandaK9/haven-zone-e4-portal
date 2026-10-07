"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { createResourceUpload, saveResource, type ResourceKind } from "@/lib/actions/resources";
import { RESOURCES_BUCKET } from "@/lib/resources/bucket";
import { MIN_LOGO_PIXELS, isVector } from "@/lib/resources/best-logo";

const KINDS: { value: ResourceKind; label: string }[] = [
  { value: "logo", label: "Logo" },
  { value: "brand", label: "Brand asset (photo, banner, template…)" },
  { value: "press", label: "Press release" },
];

// Pixel size of an image file, read in the browser before uploading.
async function imageSize(file: File): Promise<{ width: number; height: number } | undefined> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return undefined;
  try {
    const bmp = await createImageBitmap(file);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return undefined;
  }
}

export function UploadResourceDialog({ defaultKind = "logo" }: { defaultKind?: ResourceKind }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ResourceKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const lowRes =
    kind === "logo" && file && !isVector({ mime: file.type, fileName: file.name }) && size && Math.max(size.width, size.height) < MIN_LOGO_PIXELS;

  async function pick(f: File | undefined) {
    setFile(f ?? null);
    setSize(f ? await imageSize(f) : undefined);
    if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function save() {
    if (!file) return;
    setBusy(true);
    setError(null);
    const mime = file.type || "application/octet-stream";
    const token = await createResourceUpload({ name: file.name, size: file.size });
    if (!token.ok) {
      setBusy(false);
      return setError(token.error);
    }
    const { error: upErr } = await createClient().storage.from(RESOURCES_BUCKET).uploadToSignedUrl(token.path, token.token, file, { contentType: mime });
    if (upErr) {
      setBusy(false);
      return setError(upErr.message);
    }
    const res = await saveResource({
      kind,
      title,
      description,
      path: token.path,
      fileName: file.name,
      mime,
      bytes: file.size,
      width: size?.width,
      height: size?.height,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    setFile(null);
    setTitle("");
    setDescription("");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setKind(defaultKind);
          setError(null);
        }
      }}
    >
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> Upload
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to resources</DialogTitle>
          <DialogDescription>Every leader can download it. For a logo, upload the original file — SVG, PDF or EPS is best.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Select value={kind} onValueChange={(v) => setKind(v as ResourceKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input ref={input} type="file" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <Button type="button" variant="outline" className="w-full" onClick={() => input.current?.click()}>
            {file ? file.name : "Choose a file"}
          </Button>
          {size && (
            <p className="text-xs text-muted-foreground">
              {size.width} × {size.height} px
            </p>
          )}
          {lowRes && (
            <p className="text-xs text-amber-700">
              That&apos;s small for a logo (under {MIN_LOGO_PIXELS}px) — fine for now, but it&apos;ll be replaced automatically
              when a larger version is uploaded.
            </p>
          )}
          <div className="space-y-1">
            <Label htmlFor="res-title">Title</Label>
            <Input id="res-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="res-desc">Description (optional)</Label>
            <Textarea id="res-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
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
          <Button onClick={save} disabled={busy || !file || !title.trim()}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

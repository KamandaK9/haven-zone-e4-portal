"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark } from "@/components/brand-mark";
import { createClient } from "@/lib/supabase/client";
import { createCheckInBackgroundUpload, saveCheckInScreen } from "@/lib/actions/check-in-screen";
import { CHECK_IN_SCREEN_BUCKET, type CheckInScreen } from "@/lib/check-in/screen";

export function CheckInScreenForm({
  current,
  defaults,
}: {
  current: CheckInScreen & { saved: { title: string; tagline: string } };
  defaults: { title: string; tagline: string };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(current.saved.title);
  const [tagline, setTagline] = useState(current.saved.tagline);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | undefined>(current.backgroundUrl);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const shownTitle = title.trim() || defaults.title;
  const shownTagline = tagline.trim() || defaults.tagline;
  const accent = current.accent;
  const dark = current.dark || !!preview;

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    setRemoved(false);
    setPreview(URL.createObjectURL(f));
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    let background: string | null | undefined = removed ? null : undefined;
    if (file) {
      const token = await createCheckInBackgroundUpload({ name: file.name, size: file.size, type: file.type });
      if (!token.ok) {
        setBusy(false);
        return setMessage({ ok: false, text: token.error });
      }
      const { error } = await createClient().storage.from(CHECK_IN_SCREEN_BUCKET).uploadToSignedUrl(token.path, token.token, file, { contentType: file.type });
      if (error) {
        setBusy(false);
        return setMessage({ ok: false, text: error.message });
      }
      background = token.path;
    }
    const res = await saveCheckInScreen({ title, tagline, background });
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: res.error });
    setFile(null);
    setMessage({ ok: true, text: "Saved — tablets pick it up the next time self check-in opens." });
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="cis-title">Welcome title</Label>
          <Input id="cis-title" placeholder={defaults.title} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cis-tagline">Tagline</Label>
          <Input id="cis-tagline" placeholder={defaults.tagline || "e.g. Welcome home"} value={tagline} maxLength={120} onChange={(e) => setTagline(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Background image</Label>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => input.current?.click()}>
              <ImagePlus className="h-4 w-4" /> {preview ? "Change image" : "Add an image"}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="ghost"
                className="gap-2 text-red-700"
                onClick={() => {
                  setPreview(undefined);
                  setFile(null);
                  setRemoved(true);
                }}
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            A wide photo works best — the church building, worship, the congregation. It&apos;s darkened behind the text so
            names stay easy to read. JPG, PNG or WebP, up to 10 MB.
          </p>
        </div>
        {message && (
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs ${message.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {message.text}
          </div>
        )}
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Preview</p>
        <div
          className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border p-6 text-center"
          style={
            preview
              ? {
                  backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.78), rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.85)), url(${preview})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  color: "#fff",
                }
              : dark
                ? { background: `radial-gradient(ellipse at 50% -10%, ${accent}40, transparent 55%), #0a0a0a`, color: "#fff" }
                : { background: `radial-gradient(ellipse at 50% -10%, ${accent}26, transparent 55%), #fafafa`, color: "#111" }
          }
        >
          <BrandMark size={52} />
          <p className="mt-3 text-2xl font-semibold">{shownTitle}</p>
          {shownTagline && (
            <div className="mt-2 flex items-center gap-2" style={{ color: accent }}>
              <span className="h-px w-6" style={{ backgroundColor: accent }} />
              <span className="text-[10px] font-medium uppercase tracking-[0.3em]">{shownTagline}</span>
              <span className="h-px w-6" style={{ backgroundColor: accent }} />
            </div>
          )}
          <div className="mt-5 h-9 w-3/4 rounded-lg border border-white/20 bg-white/10" />
        </div>
      </div>
    </div>
  );
}

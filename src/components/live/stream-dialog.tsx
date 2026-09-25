"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { scheduleLiveStream, updateLiveStream, type LiveStreamInput } from "@/lib/actions/livestreams";
import type { LiveStream } from "@/lib/data/livestreams";
import type { LiveStreamAudience } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const AUDIENCES: { value: LiveStreamAudience; label: string; hint: string }[] = [
  { value: "zone", label: "Everyone", hint: "All members and leaders in the zone" },
  { value: "chapters", label: "Chosen chapters", hint: "Members and leaders of the chapters you pick" },
  { value: "leaders", label: "Leaders only", hint: "A briefing for leadership" },
];

// "2026-09-27T18:00" in the viewer's own time zone, for <input type=datetime-local>.
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextHalfHour(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d.toISOString();
}

export function StreamDialog({ chapters, stream }: { chapters: { id: string; name: string }[]; stream?: LiveStream }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial = () => ({
    title: stream?.title ?? "",
    description: stream?.description ?? "",
    scheduledAt: toLocalInput(stream?.scheduledAt ?? nextHalfHour()),
    audience: stream?.audience ?? ("zone" as LiveStreamAudience),
    churchIds: stream?.churchIds ?? [],
    chatEnabled: stream?.chatEnabled ?? true,
  });
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<ReturnType<typeof initial>>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setBusy(true);
    setError(null);
    // datetime-local is the viewer's local time; send it as an instant.
    const input: LiveStreamInput = { ...form, scheduledAt: new Date(form.scheduledAt).toISOString() };
    const result = stream ? await updateLiveStream(stream.id, input) : await scheduleLiveStream(input);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    if (!stream && "id" in result) router.push(`/live/${result.id}`);
    else router.refresh();
  }

  return (
    <>
      {stream ? (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setForm(initial()); setError(null); setOpen(true); }}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      ) : (
        <Button className="gap-1.5" onClick={() => { setForm(initial()); setError(null); setOpen(true); }}>
          <Plus className="h-4 w-4" />
          Schedule a stream
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{stream ? "Edit stream" : "Schedule a stream"}</DialogTitle>
            <DialogDescription>
              {stream ? "Changes show for everyone straight away." : "Viewers can open the page and wait in the lobby before you go live."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ls-title">Title</Label>
              <Input id="ls-title" value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Monthly General Meeting" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls-when">Starts</Label>
              <Input id="ls-when" type="datetime-local" value={form.scheduledAt} onChange={(e) => set({ scheduledAt: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ls-desc">What it&apos;s about</Label>
              <Textarea id="ls-desc" rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </div>
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Who can watch</legend>
              <div className="grid gap-2">
                {AUDIENCES.map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => set({ audience: a.value })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm",
                      form.audience === a.value ? "border-primary bg-primary/5" : "hover:bg-muted"
                    )}
                  >
                    <span className="font-medium">{a.label}</span>
                    <span className="block text-xs text-muted-foreground">{a.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            {form.audience === "chapters" && (
              <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border">
                {chapters.map((c) => (
                  <li key={c.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                      <Checkbox
                        checked={form.churchIds.includes(c.id)}
                        onCheckedChange={(v) =>
                          set({ churchIds: v === true ? [...form.churchIds, c.id] : form.churchIds.filter((id) => id !== c.id) })
                        }
                      />
                      {c.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <label className="flex items-center gap-2.5 text-sm">
              <Checkbox checked={form.chatEnabled} onCheckedChange={(v) => set({ chatEnabled: v === true })} />
              Live chat on
            </label>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy || !form.title.trim()}>
              {busy ? "Saving…" : stream ? "Save" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

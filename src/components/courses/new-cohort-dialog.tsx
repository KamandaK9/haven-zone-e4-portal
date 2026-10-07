"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createCohort } from "@/lib/actions/courses";
import { labels } from "@/lib/labels";

const NO_TEACHER = "none";

export function NewCohortDialog({
  courseId,
  courseName,
  churches,
  teachers,
}: {
  courseId: string;
  courseName: string;
  churches: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", churchId: churches[0]?.id ?? "", startDate: "", teacher: NO_TEACHER });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await createCohort(courseId, {
      name: form.name,
      churchId: form.churchId,
      startDate: form.startDate || undefined,
      teacherProfileId: form.teacher === NO_TEACHER ? undefined : form.teacher,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    router.push(`/courses/${res.id}`);
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
        <Plus className="h-4 w-4" /> New class group
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New {courseName} class group</DialogTitle>
          <DialogDescription>A group of students taking {courseName} together, with one teacher.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="ch-name">Name</Label>
            <Input id="ch-name" autoFocus placeholder="e.g. October 2026" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          {churches.length > 1 && (
            <div className="space-y-1">
              <Label>{labels.location}</Label>
              <Select value={form.churchId} onValueChange={(v) => setForm({ ...form, churchId: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {churches.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="ch-start">Starts</Label>
              <Input id="ch-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Teacher</Label>
              <Select value={form.teacher} onValueChange={(v) => setForm({ ...form, teacher: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEACHER}>Not yet</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {teachers.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No teachers yet — give someone the Foundation School Teacher position in Settings → Team &amp; access.
            </p>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !form.name.trim() || !form.churchId}>
              {busy ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

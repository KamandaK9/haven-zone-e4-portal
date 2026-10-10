"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createSubZone, moveChapterToSubZone, updateSubZone } from "@/lib/actions/sub-zones";
import { labels, lower } from "@/lib/labels";

export function AddSubZoneDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setName("");
          setError(null);
        }
      }}>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add a {lower(labels.subZone)}
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a {lower(labels.subZone)}</DialogTitle>
          <DialogDescription>Then move {lower(labels.locations)} into it from its page.</DialogDescription>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. ${labels.subZone} 8`} autoFocus />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                const result = await createSubZone(name);
                if (!result.ok) return setError(result.error);
                setOpen(false);
                router.push(`/sub-zones/${result.id}`);
              })
            }
          >
            {pending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditSubZoneDialog({
  subZoneId,
  name: currentName,
  foundedYear,
  history: currentHistory,
}: {
  subZoneId: string;
  name: string;
  foundedYear?: number;
  history?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [year, setYear] = useState(foundedYear ? String(foundedYear) : "");
  const [history, setHistory] = useState(currentHistory ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setName(currentName);
    setYear(foundedYear ? String(foundedYear) : "");
    setHistory(currentHistory ?? "");
    setError(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {currentName}</DialogTitle>
          <DialogDescription>Its name, when it began, and its story.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Began in</span>
            <Input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="Year" />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium">History</span>
          <Textarea
            value={history}
            onChange={(e) => setHistory(e.target.value)}
            rows={9}
            placeholder={`How the ${lower(labels.subZone)} started, how it grew, milestones…`}
          />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                const result = await updateSubZone(subZoneId, { name, foundedYear: year ? Number(year) : null, history });
                if (!result.ok) return setError(result.error);
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const NONE = "__none";

export function MoveChapterSelect({
  churchId,
  subZoneId,
  subZones,
}: {
  churchId: string;
  subZoneId?: string;
  subZones: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Select
        value={subZoneId ?? NONE}
        disabled={pending}
        onValueChange={(v) =>
          start(async () => {
            setError(null);
            const result = await moveChapterToSubZone(churchId, v === NONE ? null : v);
            if (!result.ok) return setError(result.error);
            router.refresh();
          })
        }
      >
        <SelectTrigger className="h-8 w-full text-xs sm:w-44" aria-label={`Move to another ${lower(labels.subZone)}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {subZones.map((z) => (
            <SelectItem key={z.id} value={z.id}>
              {z.name}
            </SelectItem>
          ))}
          <SelectItem value={NONE}>Not in a {lower(labels.subZone)}</SelectItem>
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

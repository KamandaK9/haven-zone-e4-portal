"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addLocation } from "@/lib/actions/churches";
import { labels, lower } from "@/lib/labels";

export function AddLocationDialog({ countryId }: { countryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await addLocation(countryId, name);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setName("");
          setError(null);
        }
      }}
    >
      <Button size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add {lower(labels.location)}
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a {lower(labels.location)}</DialogTitle>
          <DialogDescription>
            It gets its own members, {lower(labels.cells)} and leaders. You can rename it later.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`${labels.location} name`} autoFocus />
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
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Adding…" : `Add ${lower(labels.location)}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

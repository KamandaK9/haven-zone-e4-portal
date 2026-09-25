"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { renameChapter } from "@/lib/actions/churches";

export function RenameChapterDialog({
  churchId,
  currentName,
  size = "icon",
}: {
  churchId: string;
  currentName: string;
  size?: "icon" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(currentName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await renameChapter(churchId, name);
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
          setName(currentName);
          setError(null);
        }
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size={size === "icon" ? "icon" : "sm"}
        className={size === "icon" ? "h-7 w-7 shrink-0" : "gap-1.5 shrink-0"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Rename ${currentName}`}
      >
        <Pencil className="h-3.5 w-3.5" />
        {size === "default" && "Rename"}
      </Button>
      <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Rename chapter</DialogTitle>
          <DialogDescription>This changes the name everywhere it appears — the dashboard, reports, and this chapter&apos;s own page.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
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
  );
}

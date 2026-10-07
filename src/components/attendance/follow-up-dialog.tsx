"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { recordFollowUp, type FollowUpOutcome } from "@/lib/actions/follow-ups";

export const OUTCOMES: { value: FollowUpOutcome; label: string }[] = [
  { value: "reached", label: "Spoke to them" },
  { value: "no_answer", label: "No answer" },
  { value: "visited", label: "Visited" },
  { value: "other", label: "Other" },
];

export function FollowUpDialog({ memberId, memberName }: { memberId: string; memberName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<FollowUpOutcome>("reached");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await recordFollowUp(memberId, outcome, note);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setOutcome("reached");
          setNote("");
          setError(null);
        }
      }}
    >
      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <PhoneCall className="h-3.5 w-3.5" /> Record follow-up
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Follow-up with {memberName}</DialogTitle>
          <DialogDescription>How did reaching out go?</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Select value={outcome} onValueChange={(v) => setOutcome(v as FollowUpOutcome)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTCOMES.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-1">
            <Label htmlFor="fu-note">Note (optional)</Label>
            <Textarea id="fu-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
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
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cancelFollowUpTask, completeFollowUpTask } from "@/lib/actions/follow-up-tasks";
import type { FollowUpOutcome } from "@/lib/actions/follow-ups";
import { OUTCOMES } from "./follow-up-dialog";

export function TaskActions({ taskId, memberName, mine }: { taskId: string; memberName: string; mine: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<FollowUpOutcome>("reached");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant={mine ? "default" : "outline"} className="gap-1.5" onClick={() => { setError(null); setOpen(true); }}>
        <Check className="h-3.5 w-3.5" /> Done
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          if (!confirm("Take this follow-up off the list?")) return;
          await cancelFollowUpTask(taskId);
          router.refresh();
        }}
      >
        Cancel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>How did it go with {memberName}?</DialogTitle>
            <DialogDescription>This is saved on their record.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Select value={outcome} onValueChange={(v) => setOutcome(v as FollowUpOutcome)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTCOMES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea rows={3} placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Back</Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await completeFollowUpTask(taskId, outcome, note);
                setBusy(false);
                if (!res.ok) return setError(res.error);
                setOpen(false);
                router.refresh();
              }}
            >
              {busy ? "Saving…" : "Mark done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

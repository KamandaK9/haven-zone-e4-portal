"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { assignFollowUp, getFollowUpAssignees } from "@/lib/actions/follow-up-tasks";
import { positionLabel } from "@/lib/access";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function AssignFollowUpDialog({ memberId, memberName, myId }: { memberId: string; memberName: string; myId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<{ id: string; name: string; position: string }[] | null>(null);
  const [assignee, setAssignee] = useState(myId);
  const [due, setDue] = useState(inDays(3));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function show() {
    setOpen(true);
    setError(null);
    if (!people) {
      const list = await getFollowUpAssignees(memberId);
      setPeople(list);
      if (!list.some((p) => p.id === assignee) && list[0]) setAssignee(list[0].id);
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" className="gap-1.5" onClick={show}>
        <UserCheck className="h-3.5 w-3.5" /> Assign
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Who follows up with {memberName}?</DialogTitle>
            <DialogDescription>They&apos;ll see it in their follow-ups, and get an email if email is connected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {people === null ? (
              <p className="text-sm text-muted-foreground">Finding leaders…</p>
            ) : people.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leader can see this member yet.</p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label>Assign to</Label>
                  <Select value={assignee} onValueChange={setAssignee}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {people.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{p.id === myId ? " (me)" : ""} · {positionLabel(p.position as never)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="due">Due by</Label>
                  <Input id="due" type="date" value={due} min={inDays(0)} onChange={(e) => setDue(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="task-note">Note (optional)</Label>
                  <Input id="task-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. her mother was unwell" />
                </div>
              </>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={busy || !people?.length}
              onClick={async () => {
                setBusy(true);
                const res = await assignFollowUp({ memberId, assigneeId: assignee, dueDate: due, note });
                setBusy(false);
                if (!res.ok) return setError(res.error);
                setOpen(false);
                router.refresh();
              }}
            >
              {busy ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

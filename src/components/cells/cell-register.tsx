"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { saveCellMeeting } from "@/lib/actions/cell-meetings";

// A cell leader's register for one meeting: pick the cell and the day, tick
// who came, save. Changing the cell or day reloads that meeting's register.
export function CellRegister({
  cells,
  cellId,
  date,
  today,
  members,
  present,
  note,
  existing,
}: {
  cells: { id: string; name: string }[];
  cellId: string;
  date: string;
  today: string;
  members: { id: string; name: string }[];
  present: string[];
  note: string;
  existing: boolean;
}) {
  const router = useRouter();
  const [ticked, setTicked] = useState(new Set(present));
  const [noteText, setNoteText] = useState(note);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const go = (c: string, d: string) => router.push(`/cell-meetings?cell=${c}&date=${d}`);
  const allTicked = useMemo(() => members.length > 0 && members.every((m) => ticked.has(m.id)), [members, ticked]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {cells.length > 1 ? (
          <Select value={cellId} onValueChange={(v) => go(v, date)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{cells.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <p className="flex items-center text-sm font-medium">{cells[0]?.name}</p>
        )}
        <Input type="date" value={date} max={today} onChange={(e) => e.target.value && go(cellId, e.target.value)} />
      </div>

      {existing && <p className="text-xs text-muted-foreground">A register was already taken for this day — saving updates it.</p>}

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No members are in this cell yet. Put people in it from the cells page.</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => setTicked(allTicked ? new Set() : new Set(members.map((m) => m.id)))}
            >
              {allTicked ? "Clear all" : "Everyone came"}
            </button>
            <span className="text-muted-foreground">{ticked.size} of {members.length} here</span>
          </div>
          <div className="divide-y rounded-xl border">
            {members.map((m) => (
              <label key={m.id} className={cn("flex cursor-pointer items-center gap-3 px-4 py-3 text-base", ticked.has(m.id) && "bg-primary/5")}>
                <Checkbox
                  className="h-5 w-5"
                  checked={ticked.has(m.id)}
                  onCheckedChange={(v) =>
                    setTicked((t) => {
                      const n = new Set(t);
                      if (v) n.add(m.id);
                      else n.delete(m.id);
                      return n;
                    })
                  }
                />
                {m.name}
              </label>
            ))}
          </div>
        </>
      )}

      <Input placeholder="A note about the meeting (optional)" value={noteText} maxLength={300} onChange={(e) => setNoteText(e.target.value)} />
      <div className="flex items-center gap-3">
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMessage(null);
            const res = await saveCellMeeting({ cellId, date, memberIds: [...ticked], note: noteText });
            setBusy(false);
            setMessage(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
            if (res.ok) router.refresh();
          }}
        >
          {busy ? "Saving…" : existing ? "Update register" : "Save register"}
        </Button>
        {message && (
          <span className={cn("flex items-center gap-1 text-sm", message.ok ? "text-emerald-700" : "text-red-700")}>
            {message.ok && <Check className="h-4 w-4" />} {message.text}
          </span>
        )}
      </div>
    </div>
  );
}

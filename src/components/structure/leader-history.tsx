"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addPastLeader, deleteLeaderEntry, updateLeaderEntry } from "@/lib/actions/sub-zones";
import { tenureLabel, type LeaderEntry } from "@/lib/structure";

// A sub-zone's leaders over time. Current holders are recorded
// automatically; Directors add earlier ones and correct dates.
export function LeaderHistory({
  subZoneId,
  entries,
  leaderTitle,
  canEdit,
}: {
  subZoneId: string;
  entries: LeaderEntry[];
  leaderTitle: string;
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {entries.length === 0 && !adding && <p className="text-sm text-muted-foreground">No {leaderTitle.toLowerCase()}s recorded yet.</p>}
      {entries.length > 0 && (
        <ol className="relative space-y-4 border-l pl-5">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span className={`absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ${e.endedOn ? "bg-muted-foreground/40" : "bg-primary"}`} />
              {editing === e.id ? (
                <EntryForm
                  entry={e}
                  onDone={() => setEditing(null)}
                  save={(v) => updateLeaderEntry(e.id, v)}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {e.memberId ? (
                        <Link href={`/members/${e.memberId}`} className="hover:text-primary hover:underline">
                          {e.name}
                        </Link>
                      ) : (
                        e.name
                      )}
                      {!e.endedOn && <span className="ml-2 text-xs font-normal text-primary">Current</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{tenureLabel(e)}</p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Correct dates" onClick={() => setEditing(e.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {e.manual && <DeleteEntry id={e.id} />}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {canEdit &&
        (adding ? (
          <EntryForm onDone={() => setAdding(false)} save={(v) => addPastLeader(subZoneId, { name: v.name ?? "", startedOn: v.startedOn, endedOn: v.endedOn })} />
        ) : (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Add a past {leaderTitle.toLowerCase()}
          </Button>
        ))}
    </div>
  );
}

function DeleteEntry({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-7 w-7 text-muted-foreground hover:text-destructive"
      aria-label="Remove"
      disabled={pending}
      onClick={() =>
        confirm("Remove this entry?") &&
        start(async () => {
          await deleteLeaderEntry(id);
          router.refresh();
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}

function EntryForm({
  entry,
  onDone,
  save,
}: {
  entry?: LeaderEntry;
  onDone: () => void;
  save: (v: { name?: string; startedOn: string | null; endedOn: string | null }) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const nameEditable = !entry || entry.manual;
  const [name, setName] = useState(entry?.name ?? "");
  const [startedOn, setStartedOn] = useState(entry?.startedOn ?? "");
  const [endedOn, setEndedOn] = useState(entry?.endedOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      {nameEditable ? (
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" autoFocus />
      ) : (
        <p className="text-sm font-medium">{entry?.name}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">From</span>
          <Input type="date" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-muted-foreground">{entry && !entry.endedOn ? "To (leave empty if still serving)" : "To"}</span>
          <Input type="date" value={endedOn} onChange={(e) => setEndedOn(e.target.value)} />
        </label>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || (nameEditable && !name.trim())}
          onClick={() =>
            start(async () => {
              setError(null);
              const result = await save({ name, startedOn: startedOn || null, endedOn: endedOn || null });
              if (!result.ok) return setError(result.error);
              onDone();
              router.refresh();
            })
          }
        >
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

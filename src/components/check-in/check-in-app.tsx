"use client";

import { useMemo, useState } from "react";
import { Check, CloudOff, RefreshCw, Search, UserPlus, Undo2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { labels, lower } from "@/lib/labels";
import type { QueuedCheckIn, ServiceKey, ServiceKind } from "@/lib/check-in/types";
import { SERVICE_KINDS, remember, todayIn, useCheckIn } from "./use-check-in";

// The staffed check-in screen: a volunteer searches and checks people in.
// Works with no internet — see use-check-in.ts.

export function CheckInApp({ churches, timeZone }: { churches: { id: string; name: string }[]; timeZone: string }) {
  const today = useMemo(() => todayIn(timeZone), [timeZone]);
  // Rendered in the browser only (check-in-loader.tsx), so device state can
  // be read up front.
  const [churchId, setChurchId] = useState(() => {
    const saved = remember("church");
    return saved && churches.some((c) => c.id === saved) ? saved : (churches[0]?.id ?? "");
  });
  const [service, setService] = useState<Omit<ServiceKey, "churchId">>({
    date: today.date,
    kind: today.isSunday ? "sunday" : "midweek",
    name: "",
  });
  const key: ServiceKey = useMemo(() => ({ churchId, ...service }), [churchId, service]);

  const { roster, queue, queuedHere, online, syncing, syncNote, isIn, checkedInCount, checkIn: save, undo, sync } = useCheckIn(key);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [addingVisitor, setAddingVisitor] = useState(false);

  async function checkIn(memberId: string, name: string, visitor?: QueuedCheckIn["visitor"]) {
    if (!(await save(memberId, visitor))) return;
    setFlash(`${name} checked in`);
    setQuery("");
    setTimeout(() => setFlash((f) => (f === `${name} checked in` ? null : f)), 2500);
  }

  const results = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!roster || words.length === 0) return [];
    return roster.members.filter((m) => words.every((w) => m.name.toLowerCase().includes(w))).slice(0, 30);
  }, [roster, query]);
  const recent = useMemo(() => {
    const byId = new Map(roster?.members.map((m) => [m.id, m]) ?? []);
    return [...queuedHere.values()]
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
      .slice(0, 8)
      .map((q) => ({ q, name: byId.get(q.memberId)?.name ?? `${q.visitor?.firstName ?? ""} ${q.visitor?.lastName ?? ""}`.trim() }));
  }, [queuedHere, roster]);

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 pb-28">
      <div className="grid grid-cols-2 gap-2">
        {churches.length > 1 && (
          <Select value={churchId} onValueChange={setChurchId}>
            <SelectTrigger className="col-span-2">
              <SelectValue placeholder={`Choose a ${lower(labels.location)}`} />
            </SelectTrigger>
            <SelectContent>
              {churches.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={service.kind} onValueChange={(v) => setService((s) => ({ ...s, kind: v as ServiceKind }))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SERVICE_KINDS.map((k) => (
              <SelectItem key={k.value} value={k.value}>
                {k.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={service.date} max={today.date} onChange={(e) => e.target.value && setService((s) => ({ ...s, date: e.target.value }))} />
        {service.kind !== "sunday" && (
          <Input
            className="col-span-2"
            placeholder="Name of the service (optional), e.g. Communion"
            value={service.name}
            onChange={(e) => setService((s) => ({ ...s, name: e.target.value }))}
          />
        )}
      </div>

      <div className="flex items-baseline justify-between text-sm">
        <p>
          <span className="text-2xl font-semibold tabular-nums">{checkedInCount}</span>{" "}
          <span className="text-muted-foreground">checked in</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {roster
            ? `${roster.members.length} members saved on this device · ${new Date(roster.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : online
              ? "Saving the member list…"
              : "No member list on this device yet — connect once to save it."}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          className="h-14 pl-11 text-lg"
          placeholder="Search a name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {flash && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
          <Check className="h-4 w-4" /> {flash}
        </div>
      )}

      {query && (
        <div className="rounded-xl border divide-y">
          {results.length === 0 && <p className="p-4 text-sm text-muted-foreground">No one by that name.</p>}
          {results.map((m) => {
            const done = isIn(m.id);
            return (
              <div key={m.id} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[m.cell, m.ageGroup, m.isVisitor ? "First-timer" : null].filter(Boolean).join(" · ") || " "}
                  </p>
                </div>
                {done ? (
                  <Button variant="ghost" size="sm" className="gap-1.5 text-emerald-700" onClick={() => undo(m.id)}>
                    <Check className="h-4 w-4" /> In · undo
                  </Button>
                ) : (
                  <Button size="lg" onClick={() => checkIn(m.id, m.name)}>
                    Check in
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addingVisitor ? (
        <VisitorForm
          onCancel={() => setAddingVisitor(false)}
          onAdd={async (v) => {
            setAddingVisitor(false);
            await checkIn(crypto.randomUUID(), `${v.firstName} ${v.lastName}`.trim(), v);
          }}
        />
      ) : (
        <Button variant="outline" className="w-full gap-2" onClick={() => setAddingVisitor(true)}>
          <UserPlus className="h-4 w-4" /> Add a first-timer
        </Button>
      )}

      {!query && recent.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Checked in on this device</p>
          <div className="rounded-xl border divide-y">
            {recent.map(({ q, name }) => (
              <div key={q.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{name}</span>
                <button type="button" onClick={() => undo(q.memberId)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive">
                  <Undo2 className="h-3 w-3" /> undo
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 border-t px-4 py-3",
          online ? "bg-background" : "bg-amber-50 border-amber-200"
        )}
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <p className={cn("flex items-center gap-1.5 font-medium", !online && "text-amber-800")}>
              {online ? <Wifi className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
              {online ? "Online" : "Offline — check-ins are saved on this device"}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {syncNote ?? (queue.length > 0 ? `${queue.length} waiting to sync` : "Everything is synced")}
            </p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0" disabled={syncing || queue.length === 0} onClick={sync}>
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            Sync now
          </Button>
        </div>
      </div>
    </div>
  );
}

function VisitorForm({
  onAdd,
  onCancel,
}: {
  onAdd: (v: { firstName: string; lastName: string; phone: string }) => void;
  onCancel: () => void;
}) {
  const [v, setV] = useState({ firstName: "", lastName: "", phone: "" });
  return (
    <form
      className="space-y-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.firstName.trim()) onAdd(v);
      }}
    >
      <p className="font-medium">First-timer</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="v-first">First name</Label>
          <Input id="v-first" autoFocus value={v.firstName} onChange={(e) => setV({ ...v, firstName: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="v-last">Surname</Label>
          <Input id="v-last" value={v.lastName} onChange={(e) => setV({ ...v, lastName: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="v-phone">Phone (optional)</Label>
        <Input id="v-phone" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!v.firstName.trim()}>
          Check in
        </Button>
      </div>
    </form>
  );
}

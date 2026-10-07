"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CloudOff, RefreshCw, Search, UserPlus, Undo2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { labels, lower } from "@/lib/labels";
import { getCheckInRoster, getServiceCheckIns, syncCheckIns, undoCheckIn } from "@/lib/actions/check-in";
import { deviceId, getRoster, queueAdd, queueAll, queueRemove, saveRoster } from "@/lib/check-in/store";
import { serviceKeyString, type QueuedCheckIn, type Roster, type ServiceKey, type ServiceKind } from "@/lib/check-in/types";

// The check-in screen. Works with no internet: the member list is saved on
// the device while online, every check-in is saved on the device first, and
// waiting check-ins sync when the connection is back (automatically, or with
// "Sync now"). See src/lib/check-in/ and public/sw.js.

const KINDS: { value: ServiceKind; label: string }[] = [
  { value: "sunday", label: "Sunday service" },
  { value: "midweek", label: "Midweek service" },
  { value: "special", label: "Special service" },
];

function todayIn(timeZone: string): { date: string; isSunday: boolean } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, isSunday: parts.weekday === "Sun" };
}

const remember = (key: string, value?: string) => {
  try {
    if (value === undefined) return localStorage.getItem(`check-in:${key}`) ?? undefined;
    localStorage.setItem(`check-in:${key}`, value);
  } catch {
    /* private mode — just don't remember */
  }
  return undefined;
};

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

  const [roster, setRoster] = useState<Roster | undefined>();
  const [queue, setQueue] = useState<QueuedCheckIn[]>([]);
  const [serverCheckedIn, setServerCheckedIn] = useState<Set<string>>(new Set());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [addingVisitor, setAddingVisitor] = useState(false);
  const device = useRef<string>("");

  const syncRef = useRef<() => void>(() => {});

  // The device's queue; online/offline (syncing as soon as we're back); the
  // service worker that lets this page open offline.
  useEffect(() => {
    deviceId().then((id) => (device.current = id));
    queueAll().then(setQueue);
    const up = () => {
      setOnline(true);
      syncRef.current();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(async () => {
        const ready = await navigator.serviceWorker.ready;
        const assets = performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin) && /\/_next\/static\/|\/brand\/|icon/.test(u));
        ready.active?.postMessage({ type: "cache", urls: [location.pathname, ...assets] });
      });
    }
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  // The member list: whatever's saved on the device straight away, then a
  // fresh copy whenever we're online.
  useEffect(() => {
    if (!churchId) return;
    remember("church", churchId);
    let cancelled = false;
    getRoster(churchId).then((r) => !cancelled && setRoster(r));
    if (online) {
      getCheckInRoster(churchId)
        .then(async (res) => {
          if (cancelled || !res.ok) return;
          await saveRoster(res.roster);
          setRoster(res.roster);
        })
        .catch(() => setOnline(false));
    }
    return () => {
      cancelled = true;
    };
  }, [churchId, online]);

  useEffect(() => {
    if (!online || !churchId) return;
    getServiceCheckIns(key)
      .then((ids) => setServerCheckedIn(new Set(ids)))
      .catch(() => setOnline(false));
  }, [key, online, churchId]);

  const sync = useCallback(async () => {
    const waiting = await queueAll();
    if (waiting.length === 0 || syncing) return;
    setSyncing(true);
    setSyncNote(null);
    try {
      const result = await syncCheckIns(waiting);
      if (!result.ok) {
        setSyncNote(result.error);
      } else {
        await queueRemove(result.synced);
        if (result.failed.length > 0) setSyncNote(`${result.failed.length} couldn't sync: ${result.failed[0].error}`);
        const syncedIds = new Set(result.synced);
        const forThisService = waiting.filter((w) => syncedIds.has(w.id) && serviceKeyString(w.service) === serviceKeyString(key));
        if (forThisService.length) setServerCheckedIn((s) => new Set([...s, ...forThisService.map((w) => w.memberId)]));
      }
      setOnline(true);
    } catch {
      setOnline(false); // the request itself failed — no connection
    } finally {
      setQueue(await queueAll());
      setSyncing(false);
    }
  }, [key, syncing]);

  // Sync when the connection comes back (the "online" handler above), on
  // opening, and every 30s while there's a queue.
  useEffect(() => {
    syncRef.current = () => void sync();
  }, [sync]);
  useEffect(() => {
    const first = setTimeout(() => navigator.onLine && syncRef.current(), 0);
    return () => clearTimeout(first);
  }, []);
  useEffect(() => {
    const t = setInterval(() => {
      if (navigator.onLine && queue.length > 0) sync();
    }, 30_000);
    return () => clearInterval(t);
  }, [queue.length, sync]);

  const queuedHere = useMemo(
    () => new Map(queue.filter((q) => serviceKeyString(q.service) === serviceKeyString(key)).map((q) => [q.memberId, q])),
    [queue, key]
  );
  const isIn = (memberId: string) => serverCheckedIn.has(memberId) || queuedHere.has(memberId);
  const checkedInCount = new Set([...serverCheckedIn, ...queuedHere.keys()]).size;

  async function checkIn(memberId: string, name: string, visitor?: QueuedCheckIn["visitor"]) {
    if (isIn(memberId)) return;
    const item: QueuedCheckIn = {
      id: crypto.randomUUID(),
      service: key,
      memberId,
      visitor,
      checkedInAt: new Date().toISOString(),
      deviceId: device.current || (await deviceId()),
    };
    await queueAdd(item);
    setQueue(await queueAll());
    setFlash(`${name} checked in`);
    setQuery("");
    setTimeout(() => setFlash((f) => (f === `${name} checked in` ? null : f)), 2500);
    if (navigator.onLine) sync();
  }

  async function undo(memberId: string) {
    const queued = queuedHere.get(memberId);
    if (queued) {
      await queueRemove([queued.id]);
      setQueue(await queueAll());
      return;
    }
    const res = await undoCheckIn(key, memberId).catch(() => ({ ok: false, error: "No connection — try again when online." }));
    if (res.ok) setServerCheckedIn((s) => new Set([...s].filter((id) => id !== memberId)));
    else setSyncNote(res.error ?? "Couldn't undo that check-in.");
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
            {KINDS.map((k) => (
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

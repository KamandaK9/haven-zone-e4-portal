"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkInStillOpen, getCheckInRoster, getServiceCheckIns, syncCheckIns, undoCheckIn } from "@/lib/actions/check-in";
import { deviceId, getRoster, queueAdd, queueAll, queueRemove, saveRoster } from "@/lib/check-in/store";
import { serviceKeyString, type QueuedCheckIn, type Roster, type ServiceKey, type ServiceKind } from "@/lib/check-in/types";

// Everything check-in does on the device, shared by the staffed screen and
// the self check-in kiosk: the member list saved for offline use, the queue
// every check-in goes into first, and syncing it (when back online, on
// opening, every 30s, or on demand). See src/lib/check-in/ and public/sw.js.

export const SERVICE_KINDS: { value: ServiceKind; label: string }[] = [
  { value: "sunday", label: "Sunday service" },
  { value: "midweek", label: "Midweek service" },
  { value: "special", label: "Special service" },
];

export function todayIn(timeZone: string): { date: string; isSunday: boolean } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, isSunday: parts.weekday === "Sun" };
}

export const remember = (key: string, value?: string) => {
  try {
    if (value === undefined) return localStorage.getItem(`check-in:${key}`) ?? undefined;
    localStorage.setItem(`check-in:${key}`, value);
  } catch {
    /* private mode — just don't remember */
  }
  return undefined;
};

export function useCheckIn(key: ServiceKey) {
  const { churchId } = key;
  const [roster, setRoster] = useState<Roster | undefined>();
  const [queue, setQueue] = useState<QueuedCheckIn[]>([]);
  const [serverCheckedIn, setServerCheckedIn] = useState<Set<string>>(new Set());
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
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
  // Keeps the volunteer signed in while the screen is open (see
  // checkInStillOpen) — a quiet door during the sermon isn't "idle".
  useEffect(() => {
    const t = setInterval(() => {
      if (navigator.onLine) checkInStillOpen().catch(() => {});
    }, 4 * 60_000);
    return () => clearInterval(t);
  }, []);

  const queuedHere = useMemo(
    () => new Map(queue.filter((q) => serviceKeyString(q.service) === serviceKeyString(key)).map((q) => [q.memberId, q])),
    [queue, key]
  );
  const isIn = useCallback((memberId: string) => serverCheckedIn.has(memberId) || queuedHere.has(memberId), [serverCheckedIn, queuedHere]);
  const checkedInCount = new Set([...serverCheckedIn, ...queuedHere.keys()]).size;

  // Saves the check-in on the device, then tries to sync. False if they were
  // already in.
  const checkIn = useCallback(
    async (memberId: string, visitor?: QueuedCheckIn["visitor"]) => {
      if (isIn(memberId)) return false;
      await queueAdd({
        id: crypto.randomUUID(),
        service: key,
        memberId,
        visitor,
        checkedInAt: new Date().toISOString(),
        deviceId: device.current || (await deviceId()),
      });
      setQueue(await queueAll());
      if (navigator.onLine) sync();
      return true;
    },
    [isIn, key, sync]
  );

  const undo = useCallback(
    async (memberId: string) => {
      const queued = queuedHere.get(memberId);
      if (queued) {
        await queueRemove([queued.id]);
        setQueue(await queueAll());
        return;
      }
      const res = await undoCheckIn(key, memberId).catch(() => ({ ok: false, error: "No connection — try again when online." }));
      if (res.ok) setServerCheckedIn((s) => new Set([...s].filter((id) => id !== memberId)));
      else setSyncNote(res.error ?? "Couldn't undo that check-in.");
    },
    [key, queuedHere]
  );

  return { roster, queue, queuedHere, online, syncing, syncNote, isIn, checkedInCount, checkIn, undo, sync };
}

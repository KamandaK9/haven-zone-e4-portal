"use client";

import type { QueuedCheckIn, Roster } from "./types";

// The check-in screen's on-device storage (IndexedDB), so it keeps working
// with no internet: the location's member list, saved while online, and every
// check-in, saved here first and removed only once the server has it.
//
// POPIA: the roster holds names, cells and age groups only — no contact
// details — and clearDeviceData() wipes it on sign-out.

const DB = "check-in";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("rosters")) db.createObjectStore("rosters", { keyPath: "churchId" });
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? (req.result as T) : (undefined as T));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const getRoster = (churchId: string) => run<Roster | undefined>("rosters", "readonly", (s) => s.get(churchId));
export const saveRoster = (roster: Roster) => run<IDBValidKey>("rosters", "readwrite", (s) => s.put(roster));

export const queueAll = () => run<QueuedCheckIn[]>("queue", "readonly", (s) => s.getAll());
export const queueAdd = (item: QueuedCheckIn) => run<IDBValidKey>("queue", "readwrite", (s) => s.put(item));
export async function queueRemove(ids: string[]) {
  if (ids.length === 0) return;
  await run("queue", "readwrite", (s) => {
    for (const id of ids) s.delete(id);
  });
}

// A stable id for this device, so check-ins can be traced to where they
// were made.
export async function deviceId(): Promise<string> {
  const existing = await run<string | undefined>("meta", "readonly", (s) => s.get("deviceId"));
  if (existing) return existing;
  const id = crypto.randomUUID();
  await run("meta", "readwrite", (s) => s.put(id, "deviceId"));
  return id;
}

// The kiosk's background image, kept on the device so it shows offline.
type SavedImage = { url: string; blob: Blob };
export const getSavedBackground = () => run<SavedImage | undefined>("meta", "readonly", (s) => s.get("kiosk-background"));
export const saveBackground = (image: SavedImage) => run<IDBValidKey>("meta", "readwrite", (s) => s.put(image, "kiosk-background"));

// Signing out: the member list goes; check-ins still waiting to sync stay,
// so nobody's attendance is lost — they sync on the next sign-in.
export async function clearDeviceData() {
  await run("rosters", "readwrite", (s) => s.clear());
}

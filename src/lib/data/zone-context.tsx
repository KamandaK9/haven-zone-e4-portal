"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type {
  Assistant,
  Church,
  Country,
  Member,
  SuperAdmin,
  ZoneData,
} from "./types";

const STORAGE_KEY = "haven-zone-data-v1";

const EMPTY_ZONE: ZoneData = {
  zoneName: "Haven Zone E4",
  superAdmin: null,
  countries: [],
  churches: [],
  members: [],
  assistants: [],
  activity: [],
  events: [],
  setupComplete: false,
};

// Module-level store so multiple ZoneDataProvider instances (and re-renders)
// share one source of truth, read via useSyncExternalStore for a
// hydration-safe localStorage-backed store (no effect+setState needed).
let currentData: ZoneData = EMPTY_ZONE;
let storeInitialized = false;
const listeners = new Set<() => void>();

function loadFromStorage(): ZoneData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ZoneData) : EMPTY_ZONE;
  } catch {
    return EMPTY_ZONE;
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): ZoneData {
  if (!storeInitialized) {
    currentData = loadFromStorage();
    storeInitialized = true;
  }
  return currentData;
}

function getServerSnapshot(): ZoneData {
  return EMPTY_ZONE;
}

// A plain synchronous read, bypassing React's snapshot scheduling entirely.
// Use this for one-time "should I redirect" checks in an effect: relying on
// the reactive `data` value there is unsafe because the corrective
// useSyncExternalStore re-render (which replaces the getServerSnapshot
// placeholder with the real localStorage value) lands in a commit *after*
// the first commit's passive effects already flushed — so an effect that
// fires router.replace() off that first (stale) value wins the race even
// once the real value arrives a moment later.
export function readZoneDataSync(): ZoneData {
  return getSnapshot();
}

function commit(next: ZoneData) {
  currentData = next;
  storeInitialized = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode, quota) — state still updates in-memory
  }
  listeners.forEach((l) => l());
}

function slugify(name: string, existingIds: string[]): string {
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  let id = base;
  let n = 2;
  while (existingIds.includes(id)) {
    id = `${base}-${n}`;
    n++;
  }
  return id;
}

const FLAG_BY_NAME: Record<string, string> = {
  zambia: "🇿🇲",
  zimbabwe: "🇿🇼",
  malawi: "🇲🇼",
  botswana: "🇧🇼",
  mozambique: "🇲🇿",
  "south africa": "🇿🇦",
  nigeria: "🇳🇬",
  ghana: "🇬🇭",
  kenya: "🇰🇪",
  uganda: "🇺🇬",
  tanzania: "🇹🇿",
  namibia: "🇳🇦",
  angola: "🇦🇴",
  "united kingdom": "🇬🇧",
  "united states": "🇺🇸",
  canada: "🇨🇦",
};

function flagForCountry(name: string): string {
  return FLAG_BY_NAME[name.trim().toLowerCase()] ?? "🏳️";
}

type SetupPayload = {
  zoneName: string;
  superAdmin: SuperAdmin;
  countries: { name: string }[];
  churchesByCountryIndex: Record<number, { name: string }[]>;
  assistants: { name: string; email: string }[];
};

type ZoneContextValue = {
  data: ZoneData;
  completeSetup: (payload: SetupPayload) => void;
  addCountry: (name: string) => Country;
  addChurch: (countryId: string, name: string) => Church;
  addAssistant: (name: string, email: string) => Assistant;
  addMember: (member: Member) => void;
  resetZone: () => void;
};

const ZoneContext = createContext<ZoneContextValue | null>(null);

export function ZoneDataProvider({ children }: { children: React.ReactNode }) {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const completeSetup = useCallback((payload: SetupPayload) => {
    const prev = currentData;
    const countries: Country[] = [...prev.countries];
    const churches: Church[] = [...prev.churches];
    const countryIds: string[] = countries.map((c) => c.id);
    const churchIds: string[] = churches.map((c) => c.id);

    payload.countries.forEach((c, index) => {
      const name = c.name.trim();
      if (!name) return;
      const id = slugify(name, countryIds);
      countryIds.push(id);
      countries.push({ id, name, flag: flagForCountry(name) });

      const churchInputs = payload.churchesByCountryIndex[index] ?? [];
      for (const ch of churchInputs) {
        const churchName = ch.name.trim();
        if (!churchName) continue;
        const churchId = slugify(`${name}-${churchName}`, churchIds);
        churchIds.push(churchId);
        churches.push({ id: churchId, name: churchName, countryId: id });
      }
    });

    const assistantIds = prev.assistants.map((a) => a.id);
    const assistants: Assistant[] = [...prev.assistants];
    for (const a of payload.assistants) {
      if (!a.name.trim() || !a.email.trim()) continue;
      const id = slugify(a.email, assistantIds);
      assistantIds.push(id);
      assistants.push({ id, name: a.name.trim(), email: a.email.trim(), role: "Admin" });
    }

    commit({
      ...prev,
      zoneName: payload.zoneName.trim() || prev.zoneName,
      superAdmin: payload.superAdmin,
      countries,
      churches,
      assistants,
      setupComplete: true,
    });
  }, []);

  const addCountry = useCallback((name: string) => {
    const prev = currentData;
    const trimmed = name.trim();
    const id = slugify(trimmed, prev.countries.map((c) => c.id));
    const country: Country = { id, name: trimmed, flag: flagForCountry(trimmed) };
    commit({ ...prev, countries: [...prev.countries, country] });
    return country;
  }, []);

  const addChurch = useCallback((countryId: string, name: string) => {
    const prev = currentData;
    const trimmed = name.trim();
    const id = slugify(trimmed, prev.churches.map((c) => c.id));
    const church: Church = { id, name: trimmed, countryId };
    commit({ ...prev, churches: [...prev.churches, church] });
    return church;
  }, []);

  const addAssistant = useCallback((name: string, email: string) => {
    const prev = currentData;
    const id = slugify(email, prev.assistants.map((a) => a.id));
    const assistant: Assistant = { id, name: name.trim(), email: email.trim(), role: "Admin" };
    commit({ ...prev, assistants: [...prev.assistants, assistant] });
    return assistant;
  }, []);

  const addMember = useCallback((member: Member) => {
    const prev = currentData;
    commit({ ...prev, members: [member, ...prev.members] });
  }, []);

  const resetZone = useCallback(() => {
    commit(EMPTY_ZONE);
  }, []);

  const value = useMemo<ZoneContextValue>(
    () => ({ data, completeSetup, addCountry, addChurch, addAssistant, addMember, resetZone }),
    [data, completeSetup, addCountry, addChurch, addAssistant, addMember, resetZone]
  );

  return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>;
}

export function useZone() {
  const ctx = useContext(ZoneContext);
  if (!ctx) throw new Error("useZone must be used within a ZoneDataProvider");
  return ctx;
}

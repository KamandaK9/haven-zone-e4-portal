import type { Church, Country, Member, SubZone } from "@/lib/data/types";

// The structure read sub-zone first: Sub-zone → Country → locations. Pure —
// shared by the sub-zone pages and their tests.

export type SubZoneGroup = {
  subZone: SubZone | null; // null: locations not in a sub-zone yet
  countries: { country: Country; churches: Church[] }[];
  churchCount: number;
};

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true });

// Every sub-zone (in the order given) with its locations grouped by country —
// so one that crosses a border still reads right — then any locations not
// in a sub-zone. Offices aren't locations and are left out. With
// includeEmpty false, sub-zones with no visible location are dropped (a
// leader scoped to one chapter sees only their own).
export function groupBySubZone(
  subZones: readonly SubZone[],
  countries: readonly Country[],
  churches: readonly Church[],
  { includeEmpty = true }: { includeEmpty?: boolean } = {}
): SubZoneGroup[] {
  const real = churches.filter((c) => !c.isOffice);
  const countryById = new Map(countries.map((c) => [c.id, c]));
  const known = new Set(subZones.map((z) => z.id));
  const group = (subZone: SubZone | null, list: Church[]): SubZoneGroup => {
    const byCountry = new Map<string, Church[]>();
    for (const c of list) byCountry.set(c.countryId, [...(byCountry.get(c.countryId) ?? []), c]);
    return {
      subZone,
      countries: [...byCountry.entries()]
        .map(([countryId, cs]) => ({
          country: countryById.get(countryId) ?? { id: countryId, name: "Unknown", flag: "" },
          churches: [...cs].sort(byName),
        }))
        .sort((a, b) => byName(a.country, b.country)),
      churchCount: list.length,
    };
  };
  const groups = subZones
    .map((z) => group(z, real.filter((c) => c.subZoneId === z.id)))
    .filter((g) => includeEmpty || g.churchCount > 0);
  const loose = real.filter((c) => !c.subZoneId || !known.has(c.subZoneId));
  return loose.length > 0 ? [...groups, group(null, loose)] : groups;
}

// Members holding a position, optionally only within some locations.
export function holdersOf(members: readonly Member[], positionKey: string | undefined, churchIds?: ReadonlySet<string>): Member[] {
  if (!positionKey) return [];
  return members.filter((m) => m.position === positionKey && (!churchIds || churchIds.has(m.churchId)));
}

export type LeaderEntry = {
  id: string;
  name: string;
  memberId?: string;
  startedOn?: string; // YYYY-MM-DD; absent = before records began
  endedOn?: string; // absent = still serving
  manual: boolean;
};

// Current first, then most recently ended; undated earliest entries last.
export function leadershipTimeline(entries: readonly LeaderEntry[]): LeaderEntry[] {
  const key = (e: LeaderEntry) => (e.endedOn ? e.endedOn : "9999-12-31");
  return [...entries].sort((a, b) => key(b).localeCompare(key(a)) || (b.startedOn ?? "").localeCompare(a.startedOn ?? ""));
}

function monthYear(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

// "Mar 2015 – Dec 2019", "Since Jun 2021", "Until Dec 2014", "Dates not recorded".
export function tenureLabel(entry: Pick<LeaderEntry, "startedOn" | "endedOn">): string {
  const { startedOn, endedOn } = entry;
  if (startedOn && endedOn) return `${monthYear(startedOn)} – ${monthYear(endedOn)}`;
  if (startedOn) return `Since ${monthYear(startedOn)}`;
  if (endedOn) return `Until ${monthYear(endedOn)}`;
  return "Dates not recorded";
}

// ── Spotting what needs tidying after an import ─────────────────────────

export type StructureIssue =
  | { kind: "no_sub_zone" }
  | { kind: "country"; usual: string } // the only one in this country within its sub-zone
  | { kind: "duplicate"; ofId: string; ofName: string }
  | { kind: "no_leader" };

// "Grace Harare CBD2" → "harare cbd 2" (with orgWord "Grace"); a trailing " 1" is dropped, so
// "Victoria Falls 1" and "Victoria Falls" compare equal.
export function chapterNameKey(name: string, orgWord?: string): string {
  let key = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .trim();
  if (orgWord) key = key.replace(new RegExp(`^${orgWord.toLowerCase()} `), "");
  return key.replace(/ 1$/, "").replace(/\s+/g, " ");
}

// "gaborone 1 a" / "gaborone 1 b", "glen norah a" / "glen norah b": the same
// name with a different short label at the end — sister locations.
function siblings(a: string, b: string): boolean {
  const x = a.split(" ");
  const y = b.split(" ");
  const lx = x.at(-1)!;
  const ly = y.at(-1)!;
  return x.length === y.length && x.length > 1 && lx !== ly && lx.length <= 2 && ly.length <= 2 && x.slice(0, -1).join(" ") === y.slice(0, -1).join(" ");
}

function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  // Substitution, or insertion/deletion, at the first difference.
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i);
}

// What looks off about each location: not in a sub-zone; the odd one out
// country-wise in its sub-zone (one location, where at least two others
// share a country — usually filed under the wrong country); a name that's
// probably another location's twin; no leader on record.
export function structureIssues(
  churches: readonly Church[],
  countries: readonly Country[],
  leaderCount: (churchId: string) => number,
  { orgWord, checkLeaders = true }: { orgWord?: string; checkLeaders?: boolean } = {}
): Map<string, StructureIssue[]> {
  const real = churches.filter((c) => !c.isOffice);
  const countryName = new Map(countries.map((c) => [c.id, c.name]));
  const out = new Map<string, StructureIssue[]>(real.map((c) => [c.id, []]));

  const bySubZone = new Map<string, Church[]>();
  for (const c of real) {
    if (!c.subZoneId) out.get(c.id)!.push({ kind: "no_sub_zone" });
    else bySubZone.set(c.subZoneId, [...(bySubZone.get(c.subZoneId) ?? []), c]);
  }
  for (const list of bySubZone.values()) {
    const counts = new Map<string, number>();
    for (const c of list) counts.set(c.countryId, (counts.get(c.countryId) ?? 0) + 1);
    const [usualId, usualCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (usualCount < 2) continue;
    for (const c of list) {
      if (c.countryId !== usualId && counts.get(c.countryId) === 1) {
        out.get(c.id)!.push({ kind: "country", usual: countryName.get(usualId) ?? "another country" });
      }
    }
  }

  const keyed = real.map((c) => ({ c, key: chapterNameKey(c.name, orgWord) }));
  for (const [i, a] of keyed.entries()) {
    for (const b of keyed.slice(i + 1)) {
      if (a.key.length >= 4 && withinOneEdit(a.key, b.key) && !siblings(a.key, b.key)) {
        out.get(a.c.id)!.push({ kind: "duplicate", ofId: b.c.id, ofName: b.c.name });
        out.get(b.c.id)!.push({ kind: "duplicate", ofId: a.c.id, ofName: a.c.name });
      }
    }
  }

  if (checkLeaders) for (const c of real) if (leaderCount(c.id) === 0) out.get(c.id)!.push({ kind: "no_leader" });
  return out;
}

// The word most location names start with, if most do ("Grace Sandton",
// "Grace Soweto" → "Grace"), so it's ignored when comparing names.
export function commonLeadingWord(names: readonly string[]): string | undefined {
  const counts = new Map<string, number>();
  for (const n of names) {
    const w = n.trim().split(/\s+/)[0]?.toLowerCase();
    if (w && w.length > 2) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const [word, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return word && count! >= Math.max(3, names.length * 0.4) ? word : undefined;
}

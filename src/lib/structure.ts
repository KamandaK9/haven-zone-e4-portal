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

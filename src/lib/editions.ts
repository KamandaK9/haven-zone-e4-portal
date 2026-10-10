import type { ModuleKey } from "@/lib/tenant";

// Stratum ships as editions: the same engine, packaged for a kind of
// organisation. An edition decides which feature areas exist at all, the
// member statuses on offer, and a few words shared screens use. A tenant
// picks one (tenant.edition, default Cornerstone); its own settings sit on
// top. Church-only features (services and check-in, children's church,
// first-timers, courses, giving, church messaging) belong to Cornerstone.

export type EditionKey = "cornerstone" | "forge";

export type EditionDef = {
  key: EditionKey;
  name: string;
  tagline: string;
  // Feature areas this edition can include (tenant.modules picks from these).
  modules: readonly ModuleKey[];
  // A member's status (members.role), first = the default for new people.
  memberStatuses: readonly string[];
  words: {
    // Examples of who gets a login, for the getting-started checklist.
    leaderExamples: string;
  };
};

const SHARED: readonly ModuleKey[] = ["ledger", "records", "training", "livestreams", "events", "handbook", "newsletter", "resources"];

export const EDITIONS: Record<EditionKey, EditionDef> = {
  cornerstone: {
    key: "cornerstone",
    name: "Stratum Cornerstone",
    tagline: "Every chapter, every member, one foundation.",
    modules: [...SHARED, "giving", "attendance", "courses", "messaging"],
    memberStatuses: ["Member", "Worker", "Cell Leader", "Pastor"],
    words: { leaderExamples: "pastors, cell leaders, teachers and check-in volunteers" },
  },
  forge: {
    key: "forge",
    name: "Stratum Forge",
    tagline: "Every branch, every team, built to run.",
    modules: SHARED,
    memberStatuses: ["Staff", "Contractor", "Intern", "Volunteer"],
    words: { leaderExamples: "branch managers, team leads and finance staff" },
  },
};

export function editionFor(key: EditionKey | undefined): EditionDef {
  return EDITIONS[key ?? "cornerstone"] ?? EDITIONS.cornerstone;
}

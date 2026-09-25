// The zone's leadership hierarchy and what each level may do.
//
// Access = scope (which chapters a person can see) + capabilities (what they
// can do there). Position sets the defaults; the Zonal Director can grant or
// revoke individual capabilities on top (Settings → Team & access).
//
// This file is the single source of truth. The database only stores each
// login's *effective* capability list (profiles.caps) and checks it in RLS —
// so after changing defaults here, re-save people from Team & access (or run
// the recompute action there) to refresh stored caps.

export const POSITIONS = [
  "zonal_director",
  "assistant_zonal_director",
  "zonal_secretary",
  "deputy_zonal_secretary",
  "sub_zone_governor",
  "governor",
  "deputy_governor",
  "member",
] as const;
export type Position = (typeof POSITIONS)[number];

// Lower = more senior. Used so nobody can invite or edit someone at or above
// their own tier (the Zonal Director can act on anyone below them).
const POSITION_RANK: Record<Position, number> = {
  zonal_director: 0,
  assistant_zonal_director: 1,
  zonal_secretary: 2,
  deputy_zonal_secretary: 3,
  sub_zone_governor: 4,
  governor: 5,
  deputy_governor: 6,
  member: 7,
};

export const POSITION_LABELS: Record<Position, string> = {
  zonal_director: "Zonal Director",
  assistant_zonal_director: "Assistant Zonal Director",
  zonal_secretary: "Zonal Secretary",
  deputy_zonal_secretary: "Deputy Zonal Secretary",
  sub_zone_governor: "Sub Zone Governor",
  governor: "Governor",
  deputy_governor: "Deputy Governor",
  member: "Member",
};

// What a Secretary / Deputy does within their tier. Null = no portfolio.
export const PORTFOLIOS = ["finance", "programs", "administration", "operations"] as const;
export type Portfolio = (typeof PORTFOLIOS)[number];

export const PORTFOLIO_LABELS: Record<Portfolio, string> = {
  finance: "Finance",
  programs: "Programs",
  administration: "Administration",
  operations: "Operations",
};

// Which slice of the zone a position sees.
export type Scope = "zone" | "sub_zone" | "chapter" | "self";

export const CAPABILITIES = [
  "view_members",
  "view_contact_details",
  "manage_members",
  "view_giving_totals",
  "view_giving_individual",
  "import_giving",
  "manage_ledger",
  "manage_training",
  "manage_calendar",
  "send_newsletter",
  "view_reports",
  "manage_access",
  "manage_events",
  "manage_records",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const CAPABILITY_LABELS: Record<Capability, string> = {
  view_members: "View members",
  view_contact_details: "See phone, email & birthdays",
  manage_members: "Add, import & invite members",
  view_giving_totals: "See giving totals",
  view_giving_individual: "See each person's giving",
  import_giving: "Import giving",
  manage_ledger: "Manage the ledger",
  manage_training: "Manage training",
  manage_calendar: "Manage the calendar",
  send_newsletter: "Send newsletters",
  view_reports: "View reports",
  manage_access: "Manage team access",
  manage_events: "Edit annual event pages",
  manage_records: "Keep minutes, correspondence & records",
};

export function isPosition(value: unknown): value is Position {
  return POSITIONS.includes(value as Position);
}
export function isPortfolio(value: unknown): value is Portfolio {
  return PORTFOLIOS.includes(value as Portfolio);
}
export function isCapability(value: unknown): value is Capability {
  return CAPABILITIES.includes(value as Capability);
}

export function scopeForPosition(position: Position): Scope {
  switch (position) {
    case "zonal_director":
    case "assistant_zonal_director":
    case "zonal_secretary":
    case "deputy_zonal_secretary":
      return "zone";
    case "sub_zone_governor":
      return "sub_zone";
    case "governor":
    case "deputy_governor":
      return "chapter";
    case "member":
      return "self";
  }
}

// The coarse login role the rest of the app still keys off: the Directors
// run the zone; every other leader is 'admin'; members only see /me.
export function loginRoleForPosition(position: Position): "super_admin" | "admin" | "member" {
  if (position === "zonal_director" || position === "assistant_zonal_director") return "super_admin";
  return position === "member" ? "member" : "admin";
}

export function positionRank(position: Position): number {
  return POSITION_RANK[position];
}

// True when `actor` may invite or change someone holding `target`.
export function canActOn(actor: Position, target: Position): boolean {
  return POSITION_RANK[actor] < POSITION_RANK[target];
}

const BASE_LEADER: Capability[] = ["view_members", "view_contact_details", "view_giving_totals"];

export function defaultCapabilities(position: Position, portfolio: Portfolio | null): Capability[] {
  if (position === "zonal_director" || position === "assistant_zonal_director") return [...CAPABILITIES];
  if (position === "member") return [];

  const caps = new Set<Capability>(BASE_LEADER);
  // The annual event pages are edited by Zonal Secretaries and above (not
  // their Deputies); the Director can grant it to anyone else.
  if (position === "zonal_secretary") caps.add("manage_events");
  // Minutes, correspondence and the like: the secretarial side of every
  // office from Governor up. Keep in step with the backfill in
  // supabase/migrations/20260926120000_chapter_records.sql.
  if (position === "zonal_secretary" || position === "sub_zone_governor" || position === "governor") caps.add("manage_records");

  if (position === "zonal_secretary" || position === "deputy_zonal_secretary") {
    if (portfolio === "finance") {
      for (const c of ["view_giving_individual", "import_giving", "manage_ledger", "view_reports"] as const) caps.add(c);
    } else if (portfolio === "programs") {
      for (const c of ["manage_training", "manage_calendar", "send_newsletter"] as const) caps.add(c);
    } else if (portfolio === "administration" || portfolio === "operations") {
      for (const c of ["manage_members", "manage_calendar", "send_newsletter", "manage_records"] as const) caps.add(c);
    }
  } else if (position === "sub_zone_governor" || position === "governor") {
    caps.add("manage_members");
  } else if (position === "deputy_governor") {
    if (portfolio === "finance") {
      caps.add("view_giving_individual");
      caps.add("manage_ledger");
    } else if (portfolio === "administration" || portfolio === "operations") {
      caps.add("manage_members");
      caps.add("manage_calendar");
      caps.add("manage_records");
    }
  }
  return [...caps];
}

// defaults ∪ granted − revoked. Importing giving needs to read the rows it
// upserts, so it always brings per-person giving visibility with it.
export function effectiveCapabilities(
  position: Position,
  portfolio: Portfolio | null,
  granted: Capability[] = [],
  revoked: Capability[] = []
): Capability[] {
  const caps = new Set<Capability>([...defaultCapabilities(position, portfolio), ...granted]);
  for (const c of revoked) caps.delete(c);
  if (caps.has("import_giving")) caps.add("view_giving_individual");
  return CAPABILITIES.filter((c) => caps.has(c));
}

// Everything a login row stores for a given position + overrides. A plain
// member the Director has granted leadership permissions to (a Dues Champion,
// say) works at chapter level and in the portal rather than the member page —
// otherwise the grant would have no scope to apply to.
export function loginFor(
  position: Position,
  portfolio: Portfolio | null,
  granted: Capability[] = [],
  revoked: Capability[] = []
): { role: "super_admin" | "admin" | "member"; scope: Scope; caps: Capability[] } {
  const caps = effectiveCapabilities(position, portfolio, granted, revoked);
  const elevatedMember = position === "member" && caps.length > 0;
  return {
    caps,
    scope: elevatedMember ? "chapter" : scopeForPosition(position),
    role: elevatedMember ? "admin" : loginRoleForPosition(position),
  };
}

export function hasCapability(caps: readonly string[], cap: Capability): boolean {
  return caps.includes(cap);
}

// ── Designation text → position ─────────────────────────────────────────
// Spreadsheet designations are free text with many spellings ("DGF",
// "Deputy Governer", "Subzone Governor", "Financial Secretary"...).

export type ParsedDesignation = {
  position: Position;
  portfolio: Portfolio | null;
  // True when the text named a role we deliberately don't map to a position
  // (e.g. "Dues Champion") — surfaced for review rather than silently dropped.
  unrecognised: boolean;
};

function portfolioFromText(t: string): Portfolio | null {
  if (/financ|\bdgf\b|\bfin\b/.test(t)) return "finance";
  if (/program/.test(t)) return "programs";
  if (/admin|\bdga\b/.test(t)) return "administration";
  if (/operation|\bdgo\b|\bdeputy govern\w*\s*:?\s*o\b/.test(t)) return "operations";
  return null;
}

export function parseDesignation(raw: string | undefined): ParsedDesignation {
  const t = (raw ?? "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  const plain = (position: Position, portfolio: Portfolio | null = null): ParsedDesignation => ({
    position,
    portfolio,
    unrecognised: false,
  });

  if (!t || /^(members?|brother|sister)$/.test(t)) return plain("member");
  if (/assistant zonal director/.test(t)) return plain("assistant_zonal_director");
  if (/zonal director/.test(t)) return plain("zonal_director");
  if (/deputy zonal secretary/.test(t)) return plain("deputy_zonal_secretary", portfolioFromText(t));
  if (/zonal secretary/.test(t)) return plain("zonal_secretary", portfolioFromText(t));
  if (/sub ?zone governor|\bszg\b/.test(t)) return plain("sub_zone_governor");
  if (/^dg\b|\bdg[afo]\b|deputy g|dg /.test(t)) return plain("deputy_governor", portfolioFromText(t));
  if (/^gov(ern[eo]r)?$|^governor/.test(t)) return plain("governor");

  // A chapter Finance Secretary works like a finance deputy. "Dues Champion"
  // is deliberately NOT mapped — the Zonal Director can grant that person
  // finance access by hand if wanted.
  if (/financ\w* secretary/.test(t)) return plain("deputy_governor", "finance");
  if (/cell leader|pastor|special|general secretary|^secretary$|coordinator/.test(t)) {
    return { position: "member", portfolio: null, unrecognised: false };
  }
  return { position: "member", portfolio: null, unrecognised: true };
}

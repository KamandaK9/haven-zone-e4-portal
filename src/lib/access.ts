// The org's leadership hierarchy and what each level may do.
//
// Access = scope (which chapters a person can see) + capabilities (what they
// can do there). Which positions exist, their rank/scope/default caps, and
// which portfolios modify them is entirely tenant-defined (src/tenant →
// TenantConfig.access) — this file only holds the closed set of
// capabilities Stratum knows how to check, and the generic logic that reads
// a position's definition out of the tenant. A leader can grant or revoke
// individual capabilities on top of their position's defaults (Settings →
// Team & access).
//
// The database only stores each login's *effective* capability list
// (profiles.caps) and checks it in RLS — so after changing a tenant's
// position defaults, re-save people from Team & access (or run the
// recompute action there) to refresh stored caps.

import { tenant } from "@/tenant";
import type { PositionDef } from "@/lib/tenant";

// Which slice of the org a position sees. "cell" sits below "chapter"
// (a church) for tenants with leaders scoped to one cell.
export type Scope = "zone" | "sub_zone" | "chapter" | "cell" | "self";

// Position and portfolio keys are tenant-defined free text (see
// TenantConfig.access), not a fixed union — Stratum doesn't know a
// deployment's leadership titles ahead of time.
export type Position = string;
export type Portfolio = string;

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
  "manage_livestreams",
  // Attendance (services, check-in, absence, follow-up).
  "check_in",
  "view_attendance",
  "record_follow_up",
  "view_pastoral_notes",
  "manage_services",
  // Cohort-based courses (e.g. Foundation School).
  "manage_courses",
  "teach_courses",
  // Messaging (SMS/email campaigns, birthdays).
  "send_messages",
  "approve_messages",
  // Cross-cutting.
  "export_data",
  "manage_settings",
  // Give members roles ranked below your own, within what you can see —
  // without manage_access's per-person capability tweaks.
  "assign_roles",
  // Take the weekly register at a cell meeting.
  "take_cell_attendance",
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
  manage_livestreams: "Run livestreams",
  check_in: "Check members and visitors in",
  view_attendance: "View attendance lists & absentees",
  record_follow_up: "Record follow-up contact",
  view_pastoral_notes: "See pastoral notes",
  manage_services: "Manage services & schedules",
  manage_courses: "Manage cohorts & curricula",
  teach_courses: "Mark lesson attendance for own cohorts",
  send_messages: "Send SMS/email campaigns",
  approve_messages: "Approve campaigns before they send",
  export_data: "Export data (CSV/Excel)",
  manage_settings: "Manage organisation settings",
  assign_roles: "Give people roles below their own",
  take_cell_attendance: "Take cell meeting registers",
};

export function isPosition(value: unknown): value is Position {
  return typeof value === "string" && tenant.access.positions.some((p) => p.key === value);
}
export function isPortfolio(value: unknown): value is Portfolio {
  return typeof value === "string" && tenant.access.portfolios.some((p) => p.key === value);
}
export function isCapability(value: unknown): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value as Capability);
}

// True for any position other than the tenant's "no leadership" tier.
export function isLeader(position: Position): boolean {
  return position !== tenant.access.memberPositionKey;
}

export function positionDef(position: Position): PositionDef | undefined {
  return tenant.access.positions.find((p) => p.key === position);
}

export function positionLabel(position: Position): string {
  return positionDef(position)?.label ?? position;
}
export function portfolioLabel(portfolio: Portfolio): string {
  return tenant.access.portfolios.find((p) => p.key === portfolio)?.label ?? portfolio;
}

export function scopeForPosition(position: Position): Scope {
  return positionDef(position)?.scope ?? "self";
}

// The coarse login role the rest of the app still keys off.
export function loginRoleForPosition(position: Position): "super_admin" | "admin" | "member" {
  return positionDef(position)?.loginRole ?? "member";
}

// Lower = more senior. Unknown positions rank last, so they're never treated
// as senior to anyone by accident.
export function positionRank(position: Position): number {
  return positionDef(position)?.rank ?? Number.MAX_SAFE_INTEGER;
}

// True when `actor` may invite or change someone holding `target`.
export function canActOn(actor: Position, target: Position): boolean {
  return positionRank(actor) < positionRank(target);
}

export function defaultCapabilities(position: Position, portfolio: Portfolio | null): Capability[] {
  const def = positionDef(position);
  if (!def) return [];
  const caps = new Set<Capability>(def.baseCaps);
  if (portfolio && def.portfolioCaps?.[portfolio]) {
    for (const c of def.portfolioCaps[portfolio]) caps.add(c);
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
// say) works at tenant.access.elevatedMemberScope rather than "self" — a
// grant with no scope to apply to would do nothing.
export function loginFor(
  position: Position,
  portfolio: Portfolio | null,
  granted: Capability[] = [],
  revoked: Capability[] = []
): { role: "super_admin" | "admin" | "member"; scope: Scope; caps: Capability[] } {
  const caps = effectiveCapabilities(position, portfolio, granted, revoked);
  const elevatedMember = position === tenant.access.memberPositionKey && caps.length > 0;
  return {
    caps,
    scope: elevatedMember ? tenant.access.elevatedMemberScope ?? "chapter" : scopeForPosition(position),
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

// NOTE: this maps one tenant's (The Haven's) roster-spreadsheet DESIGNATION
// text to position keys, and is only reached via
// src/lib/import/parse-leadership-roster.ts, which only Haven-shaped clients
// use. It belongs in that tenant, not core — left here for now to avoid
// touching a working import path; move it if a second tenant needs
// designation-text parsing with different wording.
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

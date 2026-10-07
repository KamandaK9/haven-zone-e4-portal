import type { Capability } from "@/lib/access";
import type { PortfolioDef, PositionDef, TenantConfig } from "@/lib/tenant";

// Ready-made leadership structures a tenant can start from (the setup
// script, scripts/new-client.mjs, offers them). A tenant can always write
// its own positions instead — see TenantConfig.access.
//
// Type-only imports on purpose: a tenant file imports this, and access.ts
// imports the tenant, so a runtime import of access.ts here would be
// circular. ALL_CAPABILITIES is checked against CAPABILITIES by a test.

export const ALL_CAPABILITIES: readonly Capability[] = [
  "view_members", "view_contact_details", "manage_members",
  "view_giving_totals", "view_giving_individual", "import_giving", "manage_ledger",
  "manage_training", "manage_calendar", "send_newsletter", "view_reports",
  "manage_access", "manage_events", "manage_records", "manage_livestreams",
  "check_in", "view_attendance", "record_follow_up", "view_pastoral_notes", "manage_services",
  "manage_courses", "teach_courses",
  "send_messages", "approve_messages",
  "export_data", "manage_settings",
];

const LEADER_BASE: Capability[] = ["view_members", "view_contact_details", "view_giving_totals"];

const NETWORK_PORTFOLIOS: PortfolioDef[] = [
  { key: "finance", label: "Finance" },
  { key: "programs", label: "Programs" },
  { key: "administration", label: "Administration" },
  { key: "operations", label: "Operations" },
];

const SECRETARY_PORTFOLIO_CAPS: Record<string, Capability[]> = {
  finance: ["view_giving_individual", "import_giving", "manage_ledger", "view_reports"],
  programs: ["manage_training", "manage_calendar", "send_newsletter", "manage_livestreams"],
  administration: ["manage_members", "manage_calendar", "send_newsletter", "manage_records"],
  operations: ["manage_members", "manage_calendar", "send_newsletter", "manage_records"],
};

// A network of chapters grouped into sub-zones under a zone office (the
// structure The Haven and similar ministries use).
const CHURCH_NETWORK: PositionDef[] = [
  { key: "zonal_director", label: "Zonal Director", rank: 0, scope: "zone", loginRole: "super_admin", baseCaps: ALL_CAPABILITIES },
  { key: "assistant_zonal_director", label: "Assistant Zonal Director", rank: 1, scope: "zone", loginRole: "super_admin", baseCaps: ALL_CAPABILITIES },
  {
    key: "zonal_secretary", label: "Zonal Secretary", rank: 2, scope: "zone", loginRole: "admin",
    baseCaps: [...LEADER_BASE, "manage_events", "manage_records"], portfolioCaps: SECRETARY_PORTFOLIO_CAPS,
  },
  { key: "deputy_zonal_secretary", label: "Deputy Zonal Secretary", rank: 3, scope: "zone", loginRole: "admin", baseCaps: LEADER_BASE, portfolioCaps: SECRETARY_PORTFOLIO_CAPS },
  { key: "sub_zone_governor", label: "Sub Zone Governor", rank: 4, scope: "sub_zone", loginRole: "admin", baseCaps: [...LEADER_BASE, "manage_records", "manage_members"] },
  { key: "governor", label: "Governor", rank: 5, scope: "chapter", loginRole: "admin", baseCaps: [...LEADER_BASE, "manage_records", "manage_members"] },
  {
    key: "deputy_governor", label: "Deputy Governor", rank: 6, scope: "chapter", loginRole: "admin", baseCaps: LEADER_BASE,
    portfolioCaps: {
      finance: ["view_giving_individual", "manage_ledger"],
      administration: ["manage_members", "manage_calendar", "manage_records"],
      operations: ["manage_members", "manage_calendar", "manage_records"],
    },
  },
  { key: "member", label: "Member", rank: 7, scope: "self", loginRole: "member", baseCaps: [] },
];

// One church (optionally with several branches/campuses): pastors run it,
// staff have functional roles, cell leaders see their own cell.
const SINGLE_CHURCH: PositionDef[] = [
  { key: "senior_pastor", label: "Senior Pastor", rank: 0, scope: "zone", loginRole: "super_admin", baseCaps: ALL_CAPABILITIES },
  { key: "pastor", label: "Pastor", rank: 1, scope: "zone", loginRole: "super_admin", baseCaps: ALL_CAPABILITIES },
  {
    key: "administrator", label: "Church Administrator", rank: 2, scope: "zone", loginRole: "admin",
    baseCaps: [...LEADER_BASE, "manage_members", "manage_calendar", "send_newsletter", "manage_records", "manage_events", "manage_livestreams", "view_reports"],
  },
  {
    key: "finance_officer", label: "Finance Officer", rank: 2, scope: "zone", loginRole: "admin",
    baseCaps: [...LEADER_BASE, "view_giving_individual", "import_giving", "manage_ledger", "view_reports"],
  },
  { key: "branch_leader", label: "Branch Leader", rank: 3, scope: "chapter", loginRole: "admin", baseCaps: [...LEADER_BASE, "manage_members", "manage_records"] },
  { key: "cell_leader", label: "Cell Leader", rank: 4, scope: "cell", loginRole: "admin", baseCaps: ["view_members", "view_contact_details"] },
  { key: "member", label: "Member", rank: 5, scope: "self", loginRole: "member", baseCaps: [] },
];

export const ACCESS_PRESETS = {
  "church-network": {
    label: "Church network (zone → sub-zones → chapters)",
    access: {
      positions: CHURCH_NETWORK,
      portfolios: NETWORK_PORTFOLIOS,
      memberPositionKey: "member",
      rootPositionKey: "zonal_director",
      assistantPositionKey: "assistant_zonal_director",
    },
  },
  "single-church": {
    label: "Single church (with optional branches)",
    access: {
      positions: SINGLE_CHURCH,
      portfolios: [] as PortfolioDef[],
      memberPositionKey: "member",
      rootPositionKey: "senior_pastor",
      assistantPositionKey: "pastor",
    },
  },
} satisfies Record<string, { label: string; access: TenantConfig["access"] }>;

export type AccessPresetKey = keyof typeof ACCESS_PRESETS;

export function accessPreset(key: AccessPresetKey): TenantConfig["access"] {
  return ACCESS_PRESETS[key].access;
}

import type { TenantConfig, PositionDef } from "@/lib/tenant";
import type { Capability } from "@/lib/access";

// system_admin holds every capability Stratum defines — keep this list in
// sync with CAPABILITIES in src/lib/access.ts.
const ALL_CAPS: readonly Capability[] = [
  "view_members", "view_contact_details", "manage_members",
  "view_giving_totals", "view_giving_individual", "import_giving", "manage_ledger",
  "manage_training", "manage_calendar", "send_newsletter", "view_reports",
  "manage_access", "manage_events", "manage_records", "manage_livestreams",
  "check_in", "view_attendance", "record_follow_up", "view_pastoral_notes", "manage_services",
  "manage_courses", "teach_courses",
  "send_messages", "approve_messages",
  "export_data", "manage_settings",
];

// CE Sandton's six roles (spec §7). Rank orders seniority (lower = more
// senior, gates who may assign whom in Settings → Team & access); scope is
// which slice of the church the role sees.
//
// A Foundation School teacher's real restriction — their own cohorts only —
// isn't a group/location/cell scope at all, so it's enforced by RLS on the
// course tables (cohort.teacher_profile_id = auth.uid()) rather than by
// `scope` here; teach_courses is the only capability that matters for them.
// A check-in volunteer searches members through a dedicated scoped lookup
// (name + cell only, no contact details) rather than the Members section,
// so check_in alone is enough — no view_members/view_contact_details.
const positions: readonly PositionDef[] = [
  { key: "system_admin", label: "System Administrator", rank: 0, scope: "zone", loginRole: "super_admin", baseCaps: ALL_CAPS },
  {
    // The group is the zone (CE Sandton = group → locations → cells).
    key: "group_pastor", label: "Group Pastor", rank: 1, scope: "zone", loginRole: "admin",
    baseCaps: [
      "view_members", "view_contact_details", "manage_members", "view_reports", "export_data",
      "view_attendance", "record_follow_up", "view_pastoral_notes", "manage_services",
      "manage_courses", "send_messages", "approve_messages",
    ],
  },
  {
    key: "location_pastor", label: "Sub-group Pastor", rank: 2, scope: "chapter", loginRole: "admin",
    baseCaps: [
      "view_members", "view_contact_details", "manage_members", "view_reports", "export_data",
      "view_attendance", "record_follow_up", "view_pastoral_notes", "manage_services",
      "manage_courses", "send_messages",
    ],
  },
  {
    key: "cell_leader", label: "Cell Leader", rank: 3, scope: "cell", loginRole: "admin",
    baseCaps: ["view_members", "view_contact_details", "view_attendance", "record_follow_up"],
  },
  {
    key: "fs_teacher", label: "Foundation School Teacher", rank: 4, scope: "self", loginRole: "admin",
    baseCaps: ["teach_courses"],
  },
  {
    key: "checkin_volunteer", label: "Check-in Volunteer", rank: 5, scope: "chapter", loginRole: "admin",
    baseCaps: ["check_in"],
  },
  { key: "member", label: "Member", rank: 6, scope: "self", loginRole: "member", baseCaps: [] },
];

// CE Sandton. Everything that makes this deployment CE Sandton rather than a
// generic Stratum portal lives in this folder; see src/lib/tenant.ts.
//
// Church policy, as confirmed by the pastor (2026-10-07) — seed these into
// org_settings once Phase 2 lands:
//   - Age groups: Children 0–12, Teens 13–19, Youth 20–35, Adults 36+ (see
//     ageGroups below; the pastor wrote "adults 35+", read as following on
//     from Youth's 35).
//   - Active member: attends at least 2 Sunday services a month.
//   - Absence alert: cell leader alerted after 2 consecutive missed Sundays.
//   - Foundation School completion: 7 classes completed.
//   - Birthday messages: each day's batch is approved by someone before it
//     sends; under-18s go to the guardian's contact, not the minor.
//   - Check-in: must work offline (queue on the device, sync when back).
// Still placeholder: brand colours in theme.css (logo is an interim 500px cut).
export const tenant: TenantConfig = {
  name: "CE Sandton",
  portalName: "CE Sandton Portal",
  description: "Member management, attendance, Foundation School and communication for CE Sandton",
  defaultOrgName: "CE Sandton",
  adminNameExample: "e.g. Pastor John Doe",
  churchNameExample: "e.g. CE Sandton",
  defaultCurrency: "ZAR",
  timezone: "Africa/Johannesburg",
  // CE Sandton is the group (the zone); sub-groups under it (churches
  // rows); cells under each sub-group. sub_zones aren't used, so `group` never shows.
  labels: {
    zone: "Group", zonePlural: "Groups",
    group: "Region", groupPlural: "Regions", // sub_zones — unused
    location: "Sub-group", locationPlural: "Sub-groups",
    cell: "Cell", cellPlural: "Cells",
    country: "Country", countryPlural: "Countries",
  },
  modules: {
    // Not part of this deployment.
    giving: false,
    ledger: false,
    livestreams: false,
    records: false,
    training: false,
    events: false,
    handbook: false,
    newsletter: false,
    // The spec's core features. attendance/courses/messaging aren't built
    // in Stratum core yet (Phases 3–5) — flip stays here ready for when
    // they land.
    attendance: true,
    courses: true,
    messaging: true,
  },
  access: {
    memberPositionKey: "member",
    rootPositionKey: "system_admin",
    // No separate co-admin tier — setup's "invite assistants" step invites
    // more system_admin logins.
    assistantPositionKey: "system_admin",
    portfolios: [],
    positions,
  },
  // From the pastor (2026-10-07): active = 2+ Sunday services a month;
  // follow up after 2 missed Sundays in a row.
  attendance: { activeMinSundays: 2, absenceAlertAfter: 2 },
  // The church's own member sheet, as it keeps it — no leadership roster.
  setupImportModes: ["simple"],
  // The church's member sheet keeps one tab per group; ranges as confirmed
  // by the pastor (2026-10-07).
  ageGroups: [
    { key: "children", label: "Children", minAge: 0, maxAge: 12 },
    { key: "teens", label: "Teens", minAge: 13, maxAge: 19 },
    { key: "youth", label: "Youth", minAge: 20, maxAge: 35 },
    { key: "adults", label: "Adults", minAge: 36 },
  ],
  login: {
    headline: "One view of every sub-group, every cell, every member.",
    blurb: "Membership, service attendance, Foundation School progress and follow-up — from a single dashboard built for leadership.",
  },
  affiliation: "An arm of Christ Embassy",
  emailPlaceholder: "you@cesandton.org",
  // Interim: cut from the 500px JPEG the church sent (2026-10-07), corners
  // made transparent. Swap for a high-res/vector original once supplied.
  logo: { src: "/brand/ce-sandton-logo.png", alt: "Christ Embassy Sandton", width: 399, height: 399 },
  chartPrimary: "#4f46e5",
  chartRamp: ["#c7d2fe", "#a5b4fc", "#818cf8", "#4f46e5"],
  avatarColors: ["#4f46e5", "#0891b2", "#7c3aed", "#0d9488", "#2563eb", "#9333ea", "#0284c7"],

  countries: [{ name: "South Africa", flag: "🇿🇦" }],

  // The flagship-event-series module (modules.events) is off; the church's
  // services and one-off events go through the attendance module instead.
  eventSeries: [],

  captionLanguage: null,
  lessonExamples: {
    video: "e.g. Welcome to CE Sandton",
    quiz: "e.g. Orientation quiz",
    videoHosts: "YouTube, Vimeo, etc.",
  },

  // Unused while modules.records is off; kept populated so the type is
  // satisfied and Phase 2's own member-import wizard (not this roster
  // importer, which is Haven-format-specific) can still read chapterPrefixes
  // if useful for chapter-name matching.
  roster: {
    chapterPrefixes: ["ce sandton", "christ embassy sandton", "sandton"],
    countryGuesses: [],
  },

  records: {
    bankAccounts: [],
    // "Group" is the whole of CE Sandton (labels.zone), so the upper cell
    // level is a senior cell, as Christ Embassy calls it.
    cellLevels: { upper: "Senior cell", upperPlural: "Senior cells", lower: "Cell", lowerPlural: "Cells" },
    meetingTypes: ["Cell leaders' meeting", "Sub-group meeting"],
  },
};

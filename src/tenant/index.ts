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
  "export_data", "manage_settings", "assign_roles",
];

// CE Sandton's roles, as agreed with Daniel (2026-10-08). Rank orders
// seniority (lower = more senior): you can only give someone a role ranked
// below your own. Scope is which slice of the church the role sees:
//   zone    — all of CE Sandton
//   chapter — one sub-group
//   cell    — the cells they lead or belong to, and the cells inside those
//             (from the cells page's leader and the member's own cell)
//   self    — their own record (a teacher's class groups are enforced by
//             the course tables, not this)
// A check-in volunteer and a Foundation School teacher see names only.
const positions: readonly PositionDef[] = [
  {
    key: "system_admin", label: "System Administrator", rank: 0, scope: "zone", loginRole: "super_admin", baseCaps: ALL_CAPS,
    description: "Runs the portal: every member, every setting, features and team access.",
  },
  {
    key: "group_pastor", label: "Group Pastor", rank: 1, scope: "zone", loginRole: "admin",
    description: "Leads all of CE Sandton: every sub-group, cell and member, approves messages, and gives people their roles.",
    baseCaps: [
      "view_members", "view_contact_details", "manage_members", "view_reports", "export_data",
      "view_attendance", "record_follow_up", "view_pastoral_notes", "manage_services",
      "manage_courses", "send_messages", "approve_messages", "assign_roles",
    ],
  },
  {
    key: "location_pastor", label: "Sub-group Pastor", rank: 2, scope: "chapter", loginRole: "admin",
    description: "Leads one sub-group: its members, cells, attendance and Foundation School, and gives roles within it.",
    baseCaps: [
      "view_members", "view_contact_details", "manage_members", "view_reports", "export_data",
      "view_attendance", "record_follow_up", "view_pastoral_notes", "manage_services",
      "manage_courses", "send_messages", "assign_roles",
    ],
  },
  {
    key: "fs_principal", label: "Foundation School Principal", rank: 3, scope: "zone", loginRole: "admin",
    description: "Runs Foundation School everywhere: class groups, teachers, enrolment and every register — names only.",
    baseCaps: ["view_members", "manage_courses", "teach_courses"],
  },
  {
    key: "followup_coordinator", label: "Follow-up Coordinator", rank: 3, scope: "chapter", loginRole: "admin",
    description: "Reaches out to people who've been away from a sub-group: absentees, their numbers, and follow-up notes.",
    baseCaps: ["view_members", "view_contact_details", "view_attendance", "record_follow_up", "view_pastoral_notes"],
  },
  {
    key: "senior_cell_leader", label: "Senior Cell Leader", rank: 3, scope: "cell", loginRole: "admin",
    description: "Leads a senior cell and the cells inside it: their members, attendance and follow-ups.",
    baseCaps: ["view_members", "view_contact_details", "view_attendance", "record_follow_up"],
  },
  {
    key: "cell_leader", label: "Cell Leader", rank: 4, scope: "cell", loginRole: "admin",
    description: "Leads a cell: its members, their attendance, and following up when someone's been away.",
    baseCaps: ["view_members", "view_contact_details", "view_attendance", "record_follow_up"],
  },
  {
    key: "assistant_cell_leader", label: "Assistant Cell Leader", rank: 5, scope: "cell", loginRole: "admin",
    description: "Helps lead the cell they belong to: its members, attendance and follow-ups.",
    baseCaps: ["view_members", "view_contact_details", "view_attendance", "record_follow_up"],
  },
  {
    key: "fs_teacher", label: "Foundation School Teacher", rank: 5, scope: "self", loginRole: "admin",
    description: "Teaches their own Foundation School class groups and ticks the register — names only.",
    baseCaps: ["teach_courses"],
  },
  {
    key: "checkin_volunteer", label: "Check-in Volunteer", rank: 6, scope: "chapter", loginRole: "admin",
    description: "Checks people in at services in their sub-group, including the self check-in tablet — names only.",
    baseCaps: ["check_in"],
  },
  {
    key: "member", label: "Member", rank: 7, scope: "self", loginRole: "member", baseCaps: [],
    description: "Sees and updates their own details.",
  },
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
    resources: true,
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
  // POPIA (see /privacy, Settings → Privacy). [Bracketed] values are still
  // to be supplied by the church — Settings flags them until they are.
  legal: {
    organisationName: "[Registered name of Christ Embassy Sandton]",
    physicalAddress: "[Street address, city, postal code]",
    jurisdiction: "ZA",
    informationOfficer: { name: "[Name of the Information Officer]", email: "[privacy email address]" },
    privacyNoticeVersion: "2026-10-07",
    religiousBody: true,
    // What this deployment actually uses. Add Twilio/SendGrid when
    // messaging goes live.
    operators: [
      { name: "Supabase", purpose: "Database, sign-in and file storage", location: "Germany (Frankfurt, EU)" },
      { name: "Vercel", purpose: "Hosting the portal", location: "Germany (Frankfurt, EU), with a global delivery network" },
    ],
    // Stratum's defaults — the church to confirm.
    retention: { membersAfterLeaving: 2, financial: 5, auditLog: 5, supportAndRequests: 2 },
  },
  // From the pastor (2026-10-07): complete after 7 classes.
  course: { name: "Foundation School", classes: 7, requiredClasses: 7 },
  // The self check-in tablet at the door: the church's own gold and black.
  checkInScreen: { title: "Christ Embassy Sandton", tagline: "The Wealthy Church", accent: "#d4af37", dark: true },
  // From the pastor (2026-10-07): active = 2+ Sunday services a month;
  // follow up after 2 missed Sundays in a row.
  attendance: { activeMinSundays: 2, absenceAlertAfter: 2 },
  // The church's own member sheet, as it keeps it — no leadership roster.
  setupImportModes: ["simple"],
  // A member is a Member or a Worker (serves in a department); leadership is
  // shown from their role, never typed in twice.
  memberStatuses: ["Member", "Worker"],
  // Usual Christ Embassy departments, suggested in Settings → Departments.
  departmentSuggestions: ["Choir", "Ushering", "Media", "Protocol", "Children's Church", "Follow-up", "Foundation School", "Prayer"],
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

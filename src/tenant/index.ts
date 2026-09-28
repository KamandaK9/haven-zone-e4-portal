import { Landmark, Users, Tent } from "lucide-react";
import type { TenantConfig, PositionDef } from "@/lib/tenant";
import type { Capability } from "@/lib/access";
import { handbook } from "./handbook";

// Root/assistant hold every capability Stratum defines — keep this list in
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

// This zone's leadership tiers. Rank orders seniority (lower = more senior);
// scope is which slice of the zone the position sees.
const positions: readonly PositionDef[] = [
  { key: "zonal_director", label: "Zonal Director", rank: 0, scope: "zone", loginRole: "super_admin", baseCaps: ALL_CAPS },
  { key: "assistant_zonal_director", label: "Assistant Zonal Director", rank: 1, scope: "zone", loginRole: "super_admin", baseCaps: ALL_CAPS },
  {
    key: "zonal_secretary", label: "Zonal Secretary", rank: 2, scope: "zone", loginRole: "admin",
    baseCaps: ["view_members", "view_contact_details", "view_giving_totals", "manage_events", "manage_records"],
    portfolioCaps: {
      finance: ["view_giving_individual", "import_giving", "manage_ledger", "view_reports"],
      programs: ["manage_training", "manage_calendar", "send_newsletter", "manage_livestreams"],
      administration: ["manage_members", "manage_calendar", "send_newsletter", "manage_records"],
      operations: ["manage_members", "manage_calendar", "send_newsletter", "manage_records"],
    },
  },
  {
    key: "deputy_zonal_secretary", label: "Deputy Zonal Secretary", rank: 3, scope: "zone", loginRole: "admin",
    baseCaps: ["view_members", "view_contact_details", "view_giving_totals"],
    portfolioCaps: {
      finance: ["view_giving_individual", "import_giving", "manage_ledger", "view_reports"],
      programs: ["manage_training", "manage_calendar", "send_newsletter", "manage_livestreams"],
      administration: ["manage_members", "manage_calendar", "send_newsletter", "manage_records"],
      operations: ["manage_members", "manage_calendar", "send_newsletter", "manage_records"],
    },
  },
  {
    key: "sub_zone_governor", label: "Sub Zone Governor", rank: 4, scope: "sub_zone", loginRole: "admin",
    baseCaps: ["view_members", "view_contact_details", "view_giving_totals", "manage_records", "manage_members"],
  },
  {
    key: "governor", label: "Governor", rank: 5, scope: "chapter", loginRole: "admin",
    baseCaps: ["view_members", "view_contact_details", "view_giving_totals", "manage_records", "manage_members"],
  },
  {
    key: "deputy_governor", label: "Deputy Governor", rank: 6, scope: "chapter", loginRole: "admin",
    baseCaps: ["view_members", "view_contact_details", "view_giving_totals"],
    portfolioCaps: {
      finance: ["view_giving_individual", "manage_ledger"],
      administration: ["manage_members", "manage_calendar", "manage_records"],
      operations: ["manage_members", "manage_calendar", "manage_records"],
    },
  },
  { key: "member", label: "Member", rank: 7, scope: "self", loginRole: "member", baseCaps: [] },
];

// Example tenant. Stratum ships with this so it runs out of the box; a real
// deployment replaces this whole folder (see README → "A new client").
// Everything that makes a portal belong to one organisation lives here.
export const tenant: TenantConfig = {
  name: "Example Church",
  portalName: "Example Church Portal",
  description: "Member management and analytics for Example Church",
  defaultOrgName: "Example Church — Northern Region",
  adminNameExample: "e.g. Pastor Jane Doe",
  defaultCurrency: "USD",
  timezone: "UTC",
  labels: {
    group: "Group", groupPlural: "Groups",
    location: "Chapter", locationPlural: "Chapters",
    cell: "Cell", cellPlural: "Cells",
  },
  modules: {
    giving: true,
    ledger: true,
    livestreams: true,
    records: true,
    training: true,
    events: true,
    handbook: true,
    // Not yet built in Stratum core — flip on once shipped.
    attendance: false,
    courses: false,
    messaging: false,
  },
  access: {
    memberPositionKey: "member",
    rootPositionKey: "zonal_director",
    assistantPositionKey: "assistant_zonal_director",
    portfolios: [
      { key: "finance", label: "Finance" },
      { key: "programs", label: "Programs" },
      { key: "administration", label: "Administration" },
      { key: "operations", label: "Operations" },
    ],
    positions,
  },
  login: {
    headline: "One view of every branch, every member, every region.",
    blurb: "Membership growth, giving, training, events and livestreams — from a single dashboard built for leadership.",
  },
  affiliation: null,
  emailPlaceholder: "you@example.org",
  logo: { src: "/brand/logo-mark.svg", alt: "Example Church", width: 64, height: 64 },
  chartPrimary: "#4f46e5",
  chartRamp: ["#c7d2fe", "#a5b4fc", "#818cf8", "#4f46e5"],
  avatarColors: ["#4f46e5", "#0891b2", "#7c3aed", "#0d9488", "#2563eb", "#9333ea", "#0284c7"],

  countries: [
    { name: "South Africa", flag: "🇿🇦" },
    { name: "Kenya", flag: "🇰🇪" },
    { name: "United Kingdom", flag: "🇬🇧" },
  ],

  eventSeries: [
    { slug: "annual-conference", name: "Annual Conference", shortName: "Annual Conference", icon: Users },
    { slug: "leadership-summit", name: "Leadership Summit", shortName: "Leadership Summit", icon: Landmark },
    { slug: "retreat", name: "Family Retreat", shortName: "Retreat", icon: Tent },
  ],

  captionLanguage: "en",
  lessonExamples: {
    video: "e.g. Welcome to Example Church",
    quiz: "e.g. Orientation quiz",
    videoHosts: "YouTube, Vimeo, etc.",
  },

  roster: {
    chapterPrefixes: ["example church", "example"],
    countryGuesses: [],
  },

  records: {
    bankAccounts: [
      { key: "operating", label: "Operating Account" },
      { key: "projects", label: "Projects Account" },
    ],
    cellLevels: { upper: "Group", upperPlural: "Groups", lower: "Cell", lowerPlural: "Cells" },
    meetingTypes: ["Leadership meeting", "Branch meeting", "Finance committee"],
  },

  handbook,
};

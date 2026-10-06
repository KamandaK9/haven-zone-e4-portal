import { Landmark, Globe2, Users, Tent, Sparkles } from "lucide-react";
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

// The Haven Zone E4's leadership tiers. Rank orders seniority (lower = more senior);
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

// The Haven Zone E4. Everything that makes this deployment The Haven rather
// than a generic Stratum portal lives in this folder; see src/lib/tenant.ts.
export const tenant: TenantConfig = {
  name: "The Haven",
  portalName: "The Haven Zone Portal",
  description: "Member management and analytics for The Haven Zone E4",
  defaultOrgName: "The Haven Zone E4",
  adminNameExample: "e.g. Pastor John Kamanda",
  defaultCurrency: "USD",
  timezone: "Africa/Johannesburg",
  labels: {
    group: "Sub-zone", groupPlural: "Sub-zones",
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
    newsletter: true,
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
    headline: "One view of every chapter, every member, every country in your zone.",
    blurb:
      "Track membership growth, PCO, dues and special-project giving, and training progress across the zone — from a single dashboard built for leadership.",
  },
  affiliation: "An arm of Christ Embassy",
  emailPlaceholder: "you@havenzonee4.org",
  // public/brand/logo-mark.png is cropped from the real Haven logo — mark only,
  // the baked-in text removed.
  logo: { src: "/brand/logo-mark.png", alt: "The Haven", width: 345, height: 414 },
  chartPrimary: "#7c3aed",
  chartRamp: ["#c4b5fd", "#a78bfa", "#8b5cf6", "#7c3aed"],
  avatarColors: ["#7c3aed", "#a21caf", "#9333ea", "#be185d", "#6d28d9", "#c026d3", "#8b5cf6"],

  // The nine countries The Haven Zone E4 covers.
  countries: [
    { name: "South Africa", flag: "🇿🇦" },
    { name: "Botswana", flag: "🇧🇼" },
    { name: "Zimbabwe", flag: "🇿🇼" },
    { name: "Namibia", flag: "🇳🇦" },
    { name: "Zambia", flag: "🇿🇲" },
    { name: "Malawi", flag: "🇲🇼" },
    { name: "Eswatini", flag: "🇸🇿" },
    { name: "Mozambique", flag: "🇲🇿" },
    { name: "Angola", flag: "🇦🇴" },
  ],

  // The five annual flagship events.
  eventSeries: [
    { slug: "national-executive-assembly", name: "National Executive Assembly", shortName: "Executive Assembly", icon: Landmark },
    { slug: "international-convention", name: "The Haven International Convention", shortName: "International Convention", icon: Globe2 },
    { slug: "zonal-convention", name: "The Haven Zonal Convention", shortName: "Zonal Convention", icon: Users },
    { slug: "camp-meeting", name: "The Haven Camp Meeting", shortName: "Camp Meeting", icon: Tent },
    { slug: "special-programmes", name: "Special Programmes", shortName: "Special Programmes", icon: Sparkles },
  ],

  captionLanguage: "en",
  lessonExamples: {
    video: "e.g. Welcome to Haven Zone E4",
    quiz: "e.g. Haven Orientation quiz",
    videoHosts: "YouTube, Vimeo, KingsChat, etc.",
  },

  roster: {
    // Leadership-summary sheets prefix chapters with "Haven"/"CE"/"Christ
    // Embassy" while each sub-zone sheet uses the bare local name.
    chapterPrefixes: ["christ embassy", "ce", "haven"],
    countryGuesses: [
      ["Zimbabwe", ["belvedere","borrowdale","chinhoyi","eastlea","glen norah","glen view","harare","hatfield","amakhosi","beitbridge","bulawayo","byo","chiredzi","gwanda","gweru","hwange","kuwadzana","kwekwe","marondera","masvingo","mpopoma","msasa park","mukakose","highfield","highffield","norton","pumula","ruwa","shurugwi","sunningdale","tynwald","victoria falls","waterfalls","zvishavane","quantum grace","new bulawayo","new byo"]],
      ["Botswana", ["gaborone","francistown","jwaneng","kanye","kasane","letlhakane","lobatse","maun","mmadinare","mochudi","mogoditshane","molepolole","orapa","palapye","phikwe","ramotswa","serowe"]],
      ["South Africa", ["sandton","midrand","east london","mthatha","queenstown","qtwn","port elizabeth"]],
      ["Namibia", ["windhoek","swakopmund","walvisbay","katutura","oshakati"]],
      ["Zambia", ["kitwe","lusaka","ndola","makeni","solwezi","uptown","millenials zambia"]],
      ["Eswatini", ["ezulwini","manzini","matsapha","mbabane"]],
      ["Malawi", ["malawi"]],
    ],
  },

  records: {
    // The SOP's two chapter accounts.
    bankAccounts: [
      { key: "local_project", label: "Local Project Account" },
      { key: "global_ministry", label: "Global Ministry Account" },
    ],
    cellLevels: { upper: "Senior cell", upperPlural: "Senior cells", lower: "Cell", lowerPlural: "Cells" },
    meetingTypes: ["General Executive Assembly (GEA)", "Monthly General Meeting", "Executive meeting", "Cell leaders' meeting"],
  },

  handbook,
};

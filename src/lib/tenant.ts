import type { LucideIcon } from "lucide-react";
import type { CurrencyCode } from "@/lib/currency";
import type { HandbookContent } from "@/lib/handbook/types";
import type { Capability, Scope } from "@/lib/access";

// The contract between Stratum (everything outside src/tenant/) and the
// organisation a deployment is built for (src/tenant/). Core code reads the
// tenant only through `@/tenant`, typed by this — so standing up a portal for
// another church or business means writing a new src/tenant/ that satisfies
// TenantConfig, not editing core. Colours live next to it in
// src/tenant/theme.css (CSS can't be typed here).
export type EventSeriesDef = {
  // URL segment and the stable key an org's event_series rows are matched on.
  slug: string;
  // Seeded as the initial name; editable afterwards.
  name: string;
  shortName: string;
  icon: LucideIcon;
};

// One leadership tier. Position sets scope + capability defaults; a login's
// *effective* caps are baseCaps (+ portfolioCaps[their portfolio]) ∪ granted
// − revoked (src/lib/access.ts → effectiveCapabilities). `rank` orders
// seniority — lower is more senior — and gates who may act on whom
// (canActOn) and who a Team & access editor may assign (nobody at or above
// their own rank).
export type PositionDef = {
  key: string; // stored on members.position / profiles.position — don't rename in place once in use
  label: string;
  rank: number;
  scope: Scope;
  loginRole: "super_admin" | "admin" | "member";
  baseCaps: readonly Capability[];
  // Additive caps layered on top of baseCaps for a login with this position
  // AND the given portfolio key. Omit for tenants with no portfolios.
  portfolioCaps?: Readonly<Record<string, readonly Capability[]>>;
};

export type PortfolioDef = { key: string; label: string };

export type TenantConfig = {
  // How the organisation refers to itself in running copy ("Time in Grace Church").
  name: string;
  // Product name shown on the login page and browser tab.
  portalName: string;
  description: string;
  // Pre-filled organisation name on the setup wizard.
  defaultOrgName: string;
  // Placeholder for the super admin's name on the setup wizard.
  adminNameExample: string;
  // Display currency a new org starts with (amounts are always stored in USD;
  // admins can change this later in Settings).
  defaultCurrency: CurrencyCode;
  // IANA zone for schedules, birthdays and reports (e.g. "Africa/Johannesburg").
  timezone: string;
  // What the org calls each rung of its structure (a zone's sub_zone / church
  // / cell rows), used everywhere those levels are shown. Keys in the
  // database stay sub_zone/church/cell regardless of these labels.
  labels: {
    group: string; groupPlural: string;
    location: string; locationPlural: string;
    cell: string; cellPlural: string;
  };
  // Which optional feature areas this deployment ships with. Off hides the
  // nav item and its routes return 404 (src/lib/nav-items.ts, ModuleKey).
  // Modules not listed here (members, structure, dashboard, reports,
  // calendar, settings) are always on.
  modules: {
    giving: boolean;
    ledger: boolean;
    livestreams: boolean;
    records: boolean;
    training: boolean; // self-paced video lessons (src/app/(portal)/training)
    events: boolean; // the annual flagship-event pages
    handbook: boolean;
    newsletter: boolean; // Resend email broadcasts (src/app/(portal)/newsletter)
    attendance: boolean; // services, check-in, absence, follow-up
    courses: boolean; // cohort-based courses (e.g. Foundation School)
    messaging: boolean; // SMS/email campaigns + birthdays
  };
  access: {
    positions: readonly PositionDef[];
    portfolios: readonly PortfolioDef[];
    // The position everyone starts at with no leadership — no login by
    // default, no capabilities (the existing "member").
    memberPositionKey: string;
    // Position assigned to whoever completes /setup.
    rootPositionKey: string;
    // Position given to the extra admins invited during /setup. Same as
    // rootPositionKey for a tenant with no separate co-admin tier.
    assistantPositionKey: string;
    // Scope a member-tier login is given once granted any capability at all
    // (there'd otherwise be no scope for the grant to apply to). Defaults to
    // "chapter" if omitted.
    elevatedMemberScope?: Scope;
  };
  // Marketing panel on the login page.
  login: { headline: string; blurb: string };
  // Parent-organisation line under the login panel ("An arm of ..."), or
  // null to show nothing.
  affiliation: string | null;
  // Placeholder on email inputs — something that looks like the org's own domain.
  emailPlaceholder: string;
  logo: { src: string; alt: string; width: number; height: number };
  // Single-series chart colour. Match --primary in theme.css.
  chartPrimary: string;
  // Ordinal ramp, light → dark (e.g. tenure buckets). Each step should clear
  // 2:1 contrast on white.
  chartRamp: readonly string[];
  // Colours a new member's initials avatar is picked from.
  avatarColors: readonly string[];
  // Countries pre-listed on the setup wizard, in order.
  countries: readonly { name: string; flag: string }[];
  // Recurring flagship event series seeded for every org, in sidebar order.
  eventSeries: readonly EventSeriesDef[];
  // Language hosted lesson videos are auto-captioned in ("en", "pt", ... or
  // "auto" to detect per video); null turns auto-captions off.
  captionLanguage: string | null;
  // Placeholders in the lesson editors: example titles, and the video hosts
  // the org actually uses (shown on video-URL inputs).
  lessonExamples: { video: string; quiz: string; videoHosts: string };
  roster: {
    // Prefixes stripped when matching chapter names across sheets, lowercase
    // ("Grace Riverside" and "Riverside" are the same chapter).
    chapterPrefixes: readonly string[];
    // Chapter-name keywords → country, offered as editable guesses on import.
    countryGuesses: readonly (readonly [country: string, keywords: readonly string[]])[];
  };
  // Chapter record-keeping (Records page and the cells directory).
  records: {
    // The bank accounts a chapter operates; cheques and bank advices are filed
    // against one. Keys are stored, so don't rename them once in use.
    bankAccounts: readonly { key: string; label: string }[];
    // Names for the two levels below a chapter (e.g. Senior cell / Cell).
    cellLevels: { upper: string; upperPlural: string; lower: string; lowerPlural: string };
    // Suggested meeting types for minutes (free text is allowed too).
    meetingTypes: readonly string[];
  };
  // The org's operating manual, rendered at /handbook. Omit to hide the
  // Handbook entirely.
  handbook?: HandbookContent;
};

// A key of TenantConfig.modules, e.g. "ledger" or "attendance".
export type ModuleKey = keyof TenantConfig["modules"];

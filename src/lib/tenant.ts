import type { LucideIcon } from "lucide-react";
import type { CurrencyCode } from "@/lib/currency";
import type { HandbookContent } from "@/lib/handbook/types";

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

export type TenantConfig = {
  // How the organisation refers to itself in running copy ("Time in The Haven").
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
    // ("Haven Belvedere" and "Belvedere" are the same chapter).
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

import type { LucideIcon } from "lucide-react";

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
  // Placeholder on email inputs — something that looks like the org's own domain.
  emailPlaceholder: string;
  logo: { src: string; alt: string; width: number; height: number };
  // Single-series chart colour. Match --primary in theme.css.
  chartPrimary: string;
  // Countries pre-listed on the setup wizard, in order.
  countries: readonly { name: string; flag: string }[];
  // Recurring flagship event series seeded for every org, in sidebar order.
  eventSeries: readonly EventSeriesDef[];
  // Placeholder titles in the lesson editors.
  lessonExamples: { video: string; quiz: string };
  roster: {
    // Prefixes stripped when matching chapter names across sheets, lowercase
    // ("Haven Belvedere" and "Belvedere" are the same chapter).
    chapterPrefixes: readonly string[];
    // Chapter-name keywords → country, offered as editable guesses on import.
    countryGuesses: readonly (readonly [country: string, keywords: readonly string[]])[];
  };
};

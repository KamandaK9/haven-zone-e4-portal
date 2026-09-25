import { Landmark, Users, Tent } from "lucide-react";
import type { TenantConfig } from "@/lib/tenant";
import { handbook } from "./handbook";

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

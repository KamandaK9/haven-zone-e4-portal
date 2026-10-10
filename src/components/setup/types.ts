import type { Portfolio, Position } from "@/lib/access";
import { tenant } from "@/tenant";
import { labels, singleCountry } from "@/lib/labels";
import type { MemberList } from "./member-list";
import type { MemberField } from "@/lib/custom-fields";

export type WizardCountry = {
  name: string;
  churches: string[];
};

export type WizardAssistant = {
  name: string;
  email: string;
};

export type ImportedMemberRow = {
  countryName: string;
  churchName: string;
  member: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    role?: string; // a member status (src/lib/statuses.ts)
    givingTotal?: number;
    givingDate?: string;
    // Leadership-roster-only fields (parse-leadership-roster.ts).
    title?: string;
    kcHandle?: string;
    profession?: string;
    spouseName?: string;
    birthday?: string;
    weddingAnniversary?: string;
    position?: Position;
    portfolio?: Portfolio;
    // Simple member-list import only.
    ageGroup?: string;
    cellName?: string; // as spelled in the sheet — see WizardState.cellMap
    custom?: Record<string, string>; // field key → value, for memberFields
  };
};

export type WizardState = {
  zoneName: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  countries: WizardCountry[];
  assistants: WizardAssistant[];
  importFileName: string | null;
  importedMembers: ImportedMemberRow[];
  // Keyed `${country}::${chapter}` — sub-zone and Zonal-Office flags from the
  // roster import's review step.
  churchMeta: Record<string, { subZoneName?: string; isOffice?: boolean }>;
  // A member list with no Country/Church columns (see member-list.ts); its
  // members are placed in a church when setup is submitted.
  memberList: MemberList | null;
  // The organisation's own member fields, made while matching columns —
  // drafts (ids "draft:<key>") until setup creates them.
  memberFields: MemberField[];
};

const IMPORT_STEP_LABEL = "Import members";
const ALL_STEP_LABELS = [
  `${labels.zone} basics`,
  singleCountry ? labels.locations : `${labels.countries} & ${labels.locations.toLowerCase()}`,
  "Assistants",
  IMPORT_STEP_LABEL,
  "Review",
];

export const SETUP_IMPORT_MODES = tenant.setupImportModes ?? (["roster", "simple"] as const);

// A tenant with no setup import modes doesn't get the import step at all.
export const STEP_LABELS: readonly string[] = ALL_STEP_LABELS.filter(
  (label) => label !== IMPORT_STEP_LABEL || SETUP_IMPORT_MODES.length > 0
);

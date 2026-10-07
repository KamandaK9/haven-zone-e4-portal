import type { Portfolio, Position } from "@/lib/access";
import { tenant } from "@/tenant";

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
    role?: "Member" | "Worker" | "Cell Leader" | "Pastor";
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
};

const ALL_STEP_LABELS = ["Zone basics", "Countries & churches", "Assistants", "Import members", "Review"] as const;

// A tenant that imports its members after setup (tenant.setupMemberImport
// false) doesn't get the import step at all.
export const STEP_LABELS: readonly (typeof ALL_STEP_LABELS)[number][] = ALL_STEP_LABELS.filter(
  (label) => label !== "Import members" || tenant.setupMemberImport !== false
);

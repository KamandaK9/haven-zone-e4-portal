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
    elevateToAdmin?: boolean;
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
};

export const STEP_LABELS = [
  "Zone basics",
  "Countries & churches",
  "Assistants",
  "Import members",
  "Review",
] as const;

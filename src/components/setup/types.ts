export type WizardCountry = {
  name: string;
  churches: string[];
};

export type WizardAssistant = {
  name: string;
  email: string;
};

export type WizardState = {
  zoneName: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  countries: WizardCountry[];
  assistants: WizardAssistant[];
  importFileName: string | null;
};

export const STEP_LABELS = [
  "Zone basics",
  "Countries",
  "Churches",
  "Assistants",
  "Import members",
  "Review",
] as const;

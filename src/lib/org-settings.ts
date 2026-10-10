import { tenant } from "@/tenant";

// Settings an organisation changes for itself (Settings → Organisation),
// stored in zones.settings over the tenant file's defaults — so a client is
// unchanged until an admin edits something. Pure; the server reads them
// through getOrgSettings (org-settings-server.ts).

export type BankAccount = { key: string; label: string };
export type AttendanceRules = { activeMinSundays: number; absenceAlertAfter: number };

export type OrgSettings = {
  login: { headline: string; blurb: string };
  bankAccounts: BankAccount[];
  meetingTypes: string[];
  departmentSuggestions: string[];
  attendance: AttendanceRules;
};

export function defaultOrgSettings(): OrgSettings {
  return {
    login: { headline: tenant.login.headline, blurb: tenant.login.blurb },
    bankAccounts: tenant.records.bankAccounts.map((a) => ({ ...a })),
    meetingTypes: [...tenant.records.meetingTypes],
    departmentSuggestions: [...(tenant.departmentSuggestions ?? [])],
    attendance: {
      activeMinSundays: tenant.attendance?.activeMinSundays ?? 2,
      absenceAlertAfter: tenant.attendance?.absenceAlertAfter ?? 2,
    },
  };
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : undefined);
const strings = (v: unknown, max: number) =>
  Array.isArray(v) ? [...new Set(v.map((x) => str(x, max)).filter((x): x is string => !!x))].slice(0, 50) : undefined;
const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 12 ? (v as number) : undefined);

// The stored object over the defaults; anything malformed is ignored.
export function applyOrgOverrides(defaults: OrgSettings, stored: unknown): OrgSettings {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return defaults;
  const s = stored as Record<string, unknown>;
  const login = (s.login ?? {}) as Record<string, unknown>;
  const attendance = (s.attendance ?? {}) as Record<string, unknown>;
  const accounts = Array.isArray(s.bankAccounts)
    ? s.bankAccounts
        .map((a) => (a && typeof a === "object" ? { key: str((a as BankAccount).key, 40), label: str((a as BankAccount).label, 80) } : {}))
        .filter((a): a is BankAccount => !!a.key && !!a.label && /^[a-z][a-z0-9_]*$/.test(a.key))
    : undefined;
  return {
    login: { headline: str(login.headline, 120) ?? defaults.login.headline, blurb: str(login.blurb, 400) ?? defaults.login.blurb },
    bankAccounts: accounts?.length ? accounts : defaults.bankAccounts,
    meetingTypes: strings(s.meetingTypes, 80) ?? defaults.meetingTypes,
    departmentSuggestions: strings(s.departmentSuggestions, 80) ?? defaults.departmentSuggestions,
    attendance: {
      activeMinSundays: count(attendance.activeMinSundays) ?? defaults.attendance.activeMinSundays,
      absenceAlertAfter: count(attendance.absenceAlertAfter) ?? defaults.attendance.absenceAlertAfter,
    },
  };
}

// What's wrong with settings about to be saved, if anything.
export function validateOrgSettings(s: OrgSettings): string | null {
  if (!s.login.headline.trim() || s.login.headline.length > 120) return "The login headline needs to be 1–120 characters.";
  if (s.login.blurb.length > 400) return "Keep the login text under 400 characters.";
  if (s.bankAccounts.length === 0) return "Keep at least one bank account.";
  if (s.bankAccounts.some((a) => !a.label.trim() || a.label.length > 80)) return "Every bank account needs a name (up to 80 characters).";
  if (new Set(s.bankAccounts.map((a) => a.label.trim().toLowerCase())).size !== s.bankAccounts.length) return "Two bank accounts have the same name.";
  if (s.meetingTypes.some((m) => m.length > 80) || s.departmentSuggestions.some((d) => d.length > 80)) return "Keep each item under 80 characters.";
  for (const n of [s.attendance.activeMinSundays, s.attendance.absenceAlertAfter]) {
    if (!Number.isInteger(n) || n < 1 || n > 12) return "Attendance numbers must be between 1 and 12.";
  }
  return null;
}

// A key for a new bank account, from its name, unique among `taken`.
export function accountKeyFrom(label: string, taken: readonly string[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "a_$1").slice(0, 30) || "account";
  let key = base;
  for (let n = 2; taken.includes(key); n++) key = `${base}_${n}`;
  return key;
}

import type { LegalConfig, LegalContact } from "@/lib/tenant";

// The privacy details an organisation can change in Settings, stored on
// zones.legal_settings over the tenant's defaults. Pure — shared by the
// Settings form, the save action and the loader.

export type LegalOverrides = Partial<
  Pick<LegalConfig, "organisationName" | "physicalAddress" | "informationOfficer" | "operators" | "retention" | "privacyNoticeVersion">
> & { deputyInformationOfficer?: LegalContact | null };

const text = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const contact = (v: unknown): LegalContact | undefined => {
  if (!v || typeof v !== "object") return undefined;
  const c = v as Record<string, unknown>;
  const name = text(c.name, 120);
  const email = text(c.email, 200);
  if (!name || !email) return undefined;
  const phone = text(c.phone, 40);
  return { name, email, ...(phone ? { phone } : {}) };
};

// Stored overrides over the defaults. Anything malformed in storage is
// ignored field by field, so a bad value can never blank the notice.
export function applyLegalOverrides(defaults: LegalConfig, stored: unknown): LegalConfig {
  if (!stored || typeof stored !== "object") return defaults;
  const o = stored as Record<string, unknown>;
  const operators = Array.isArray(o.operators)
    ? o.operators
        .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
        .map((x) => ({ name: text(x.name, 80) ?? "", purpose: text(x.purpose, 200) ?? "", location: text(x.location, 120) ?? "" }))
        .filter((x) => x.name)
    : undefined;
  const r = o.retention && typeof o.retention === "object" ? (o.retention as Record<string, unknown>) : {};
  const years = (v: unknown, fallback: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 100 ? v : fallback);
  const deputy = o.deputyInformationOfficer === null ? null : contact(o.deputyInformationOfficer);

  return {
    ...defaults,
    organisationName: text(o.organisationName) || defaults.organisationName,
    physicalAddress: text(o.physicalAddress, 500) || defaults.physicalAddress,
    informationOfficer: contact(o.informationOfficer) ?? defaults.informationOfficer,
    deputyInformationOfficer: deputy === null ? undefined : (deputy ?? defaults.deputyInformationOfficer),
    operators: operators && operators.length > 0 ? operators : defaults.operators,
    retention: {
      membersAfterLeaving: years(r.membersAfterLeaving, defaults.retention.membersAfterLeaving),
      financial: years(r.financial, defaults.retention.financial),
      auditLog: years(r.auditLog, defaults.retention.auditLog),
      supportAndRequests: years(r.supportAndRequests, defaults.retention.supportAndRequests),
    },
    privacyNoticeVersion: text(o.privacyNoticeVersion, 40) || defaults.privacyNoticeVersion,
  };
}

// First problem with an edited set of details, as a sentence; null if fine.
export function validateLegal(l: LegalConfig): string | null {
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!l.organisationName.trim()) return "Enter the organisation's registered name.";
  if (!l.physicalAddress.trim()) return "Enter the physical address.";
  if (!l.informationOfficer.name.trim()) return "Enter the Information Officer's name.";
  if (!email.test(l.informationOfficer.email)) return "Enter a valid email for the Information Officer.";
  if (l.deputyInformationOfficer && (!l.deputyInformationOfficer.name.trim() || !email.test(l.deputyInformationOfficer.email))) {
    return "Give the deputy a name and a valid email, or remove the deputy.";
  }
  if (l.operators.length === 0) return "List at least one service provider.";
  if (l.operators.some((o) => !o.name.trim() || !o.purpose.trim() || !o.location.trim())) {
    return "Each service provider needs a name, what it does, and where it's based.";
  }
  const r = l.retention;
  if ([r.membersAfterLeaving, r.financial, r.auditLog, r.supportAndRequests].some((n) => !Number.isInteger(n) || n < 0 || n > 100)) {
    return "Retention periods must be whole numbers of years.";
  }
  return null;
}

// The version to publish a changed notice under: today's date, or today's
// date with a suffix if the notice already changed today.
export function nextNoticeVersion(current: string, today: Date = new Date()): string {
  const date = today.toISOString().slice(0, 10);
  if (!current.startsWith(date)) return date;
  const n = Number(current.slice(date.length + 1)) || 1;
  return `${date}.${n + 1}`;
}

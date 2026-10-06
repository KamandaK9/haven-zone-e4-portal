import type { DataRequestKind } from "@/lib/supabase/types";
import type { LegalConfig } from "@/lib/tenant";

export const DATA_REQUEST_KINDS: { value: DataRequestKind; label: string; hint: string }[] = [
  { value: "access", label: "See what you hold about me", hint: "A copy of your personal information and who it's been shared with." },
  { value: "correction", label: "Correct my information", hint: "Something about you is wrong or out of date." },
  { value: "deletion", label: "Delete my information", hint: "Some records (e.g. giving) must be kept for a time by law — you'll be told what can and can't be removed." },
  { value: "objection", label: "Object to how it's used", hint: "Stop a particular use of your information, e.g. newsletters." },
  { value: "other", label: "Something else", hint: "Any other privacy question." },
];

export function dataRequestKindLabel(kind: string): string {
  return DATA_REQUEST_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

// Fields still holding a "[placeholder]" — shown to admins so the privacy
// notice isn't published unfinished.
export function legalGaps(legal: LegalConfig): string[] {
  const gaps: string[] = [];
  const check = (label: string, value: string | undefined) => {
    if (value && /\[[^\]]+\]/.test(value)) gaps.push(label);
  };
  check("Organisation name", legal.organisationName);
  check("Physical address", legal.physicalAddress);
  check("Information Officer name", legal.informationOfficer.name);
  check("Information Officer email", legal.informationOfficer.email);
  check("Information Officer phone", legal.informationOfficer.phone);
  if (legal.deputyInformationOfficer) {
    check("Deputy Information Officer name", legal.deputyInformationOfficer.name);
    check("Deputy Information Officer email", legal.deputyInformationOfficer.email);
  }
  legal.operators.forEach((o) => check(`${o.name} location`, o.location));
  return gaps;
}

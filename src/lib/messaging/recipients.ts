import { tenant } from "@/tenant";
import { renderMessage, smsSegments, toE164 } from "./text";

// Turning members into the people a message is addressed to: each member
// themselves, or — for a minor — their guardian; never someone who opted out.

export type MemberForMessage = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  age_group: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  messaging_opt_out: boolean;
};

export type Recipient = {
  memberId: string;
  name: string;
  to: string;
  via: "self" | "guardian";
  body: string;
  segments: number;
};

export type Skipped = { optedOut: number; noContact: number; noGuardian: number; duplicate: number };

export const isMinor = (ageGroup: string | null): boolean => !!ageGroup && (tenant.messaging?.minorAgeGroups ?? []).includes(ageGroup);

// `templates.guardian` is used when the message goes to a guardian; without
// one, the same text is used with "(For Thabo)" in front so the guardian
// knows who it's about.
export function buildRecipients(
  members: MemberForMessage[],
  channel: "sms" | "email",
  templates: { self: string; guardian?: string },
  opts: { footer?: string } = {}
): { recipients: Recipient[]; skipped: Skipped } {
  const skipped: Skipped = { optedOut: 0, noContact: 0, noGuardian: 0, duplicate: 0 };
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  const cc = tenant.messaging?.countryCode ?? "27";

  for (const m of members) {
    if (m.messaging_opt_out) {
      skipped.optedOut++;
      continue;
    }
    const minor = isMinor(m.age_group);
    let to: string | undefined;
    if (channel === "sms") {
      to = toE164(minor ? m.guardian_phone : m.phone, cc);
    } else {
      // Email goes to the member; there's no guardian email on file, so
      // minors can't be emailed.
      to = minor ? undefined : (m.email?.trim().toLowerCase() || undefined);
    }
    if (!to) {
      if (minor) skipped.noGuardian++;
      else skipped.noContact++;
      continue;
    }
    const via = minor ? "guardian" : "self";
    const vars = {
      first_name: m.first_name,
      name: `${m.first_name} ${m.last_name}`.trim(),
      guardian_name: m.guardian_name?.trim() || "there",
      church: tenant.name,
    };
    let text = renderMessage(via === "guardian" ? (templates.guardian ?? `(For {first_name}) ${templates.self}`) : templates.self, vars);
    if (channel === "sms" && opts.footer?.trim()) text = `${text}\n${opts.footer.trim()}`;
    const key = `${to}|${text}`;
    if (seen.has(key)) {
      skipped.duplicate++;
      continue;
    }
    seen.add(key);
    recipients.push({
      memberId: m.id,
      name: vars.name,
      to,
      via,
      body: text,
      segments: channel === "sms" ? smsSegments(text).segments : 1,
    });
  }
  return { recipients, skipped };
}

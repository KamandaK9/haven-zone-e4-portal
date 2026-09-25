import "server-only";
import { namesAgree, normalizePhone } from "@/lib/name-match";
import type { Member } from "./types";

export type DuplicateReason = "same email" | "same phone" | "same name in this chapter";

export type DuplicatePair = {
  a: Member;
  b: Member;
  reasons: DuplicateReason[];
};

// Finds members in `members` that are likely the same person. This is meant
// to run on an already-scope-filtered list (see getZoneDataset) — a Governor
// only ever passes their own chapter's members, a Director the whole zone —
// so the result is automatically limited to what the caller may act on.
//
// Two rows count as a match when their names agree (tolerating typos, same
// as the roster importer) AND they share an email, a phone number, or the
// same chapter. A shared email/phone across chapters is still worth
// surfacing (someone re-entered under the wrong chapter); a shared chapter
// alone, with no matching identifier, is the "duplicate row from a messy
// import" case.
export function findDuplicateMemberPairs(members: Member[]): DuplicatePair[] {
  const byEmail = new Map<string, Member[]>();
  const byPhone = new Map<string, Member[]>();
  const byChurch = new Map<string, Member[]>();

  for (const m of members) {
    const email = m.email?.trim().toLowerCase();
    if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), m]);
    const phone = normalizePhone(m.phone);
    if (phone) byPhone.set(phone, [...(byPhone.get(phone) ?? []), m]);
    byChurch.set(m.churchId, [...(byChurch.get(m.churchId) ?? []), m]);
  }

  const pairs = new Map<string, DuplicatePair>();
  function addPair(a: Member, b: Member, reason: DuplicateReason) {
    const key = [a.id, b.id].sort().join("|");
    const existing = pairs.get(key);
    if (existing) {
      if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
    } else {
      pairs.set(key, { a, b, reasons: [reason] });
    }
  }

  function scan(groups: Map<string, Member[]>, reason: DuplicateReason) {
    for (const group of groups.values()) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          if (namesAgree(group[i], group[j])) addPair(group[i], group[j], reason);
        }
      }
    }
  }

  scan(byEmail, "same email");
  scan(byPhone, "same phone");
  scan(byChurch, "same name in this chapter");

  return [...pairs.values()];
}

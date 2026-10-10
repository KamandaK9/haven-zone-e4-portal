import { edition } from "@/lib/edition";
import { tenant } from "@/tenant";
import type { MemberRole } from "@/lib/data/types";

// A member's status (members.role): the tenant's own list, or its edition's
// (Cornerstone: Member / Worker / Cell Leader / Pastor; Forge: Staff …).
export const MEMBER_STATUSES: readonly MemberRole[] = tenant.memberStatuses ?? edition.memberStatuses;

// What a new person is, unless said otherwise.
export const DEFAULT_MEMBER_STATUS: MemberRole = MEMBER_STATUSES[0] ?? "Member";

// A status as given (e.g. from a spreadsheet), or the default if it isn't one
// of this organisation's.
export function memberStatusOr(value: string | undefined | null): MemberRole {
  const match = MEMBER_STATUSES.find((s) => s.toLowerCase() === (value ?? "").trim().toLowerCase());
  return match ?? DEFAULT_MEMBER_STATUS;
}

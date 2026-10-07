import { tenant } from "@/tenant";
import type { MemberRole } from "@/lib/data/types";

// A member's status (members.role): the tenant's own list, or Stratum's four.
export const MEMBER_STATUSES: readonly MemberRole[] = tenant.memberStatuses ?? ["Member", "Worker", "Cell Leader", "Pastor"];

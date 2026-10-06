import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/data/get-dataset";
import type { Json } from "@/lib/supabase/types";

// Which record an action touched, and its state before/after — e.g. a
// merge's losing row, an access change's old/new caps, or an export's
// filters and row count. Optional: pass it when the action has a single
// clear subject worth reconstructing later, skip it for actions the
// summary text already fully describes.
export type AuditDetail = {
  entity?: { type: string; id: string };
  before?: Json;
  after?: Json;
};

// Only ever called for staff-initiated actions — audit_log's insert policy
// is staff-only (see supabase/migrations/), and member self-service actions
// (e.g. marking their own training complete) aren't logged here by design.
export async function logAudit(
  profile: CurrentProfile,
  action: string,
  summary: string,
  detail?: AuditDetail
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("audit_log").insert({
    zone_id: profile.zoneId,
    actor_id: profile.userId,
    actor_name: profile.fullName,
    action,
    summary,
    entity_type: detail?.entity?.type ?? null,
    entity_id: detail?.entity?.id ?? null,
    before: detail?.before ?? null,
    after: detail?.after ?? null,
  });
}

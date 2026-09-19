import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/data/get-dataset";

// Only ever called for staff-initiated actions — audit_log's insert policy
// is staff-only (see migration.sql), and member self-service actions
// (e.g. marking their own training complete) aren't logged here by design.
export async function logAudit(profile: CurrentProfile, action: string, summary: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("audit_log").insert({
    zone_id: profile.zoneId,
    actor_id: profile.userId,
    actor_name: profile.fullName,
    action,
    summary,
  });
}

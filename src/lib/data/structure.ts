import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LeaderEntry } from "@/lib/structure";

// Who has held a position in a sub-zone over time (leaders only, by RLS).
// Empty if the history table doesn't exist yet (migration not applied).
export async function getLeadershipHistory(subZoneId: string, positionKey: string | undefined): Promise<LeaderEntry[]> {
  if (!positionKey) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("position_history")
    .select("id, member_id, member_name, started_on, ended_on, manual")
    .eq("sub_zone_id", subZoneId)
    .eq("position", positionKey);
  if (error) return [];
  return data.map((h) => ({
    id: h.id,
    name: h.member_name,
    memberId: h.member_id ?? undefined,
    startedOn: h.started_on ?? undefined,
    endedOn: h.ended_on ?? undefined,
    manual: h.manual,
  }));
}

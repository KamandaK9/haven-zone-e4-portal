import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildRecipients, type MemberForMessage, type Recipient, type Skipped } from "./recipients";

// Who a message is for. Everything is optional and filters combine: leave
// all empty for everyone the sender can see.
export type Audience = {
  churchId?: string;
  cellId?: string; // that cell and the cells inside it
  ageGroup?: string;
  departmentId?: string;
  firstTimers?: boolean;
  workers?: boolean;
};

const COLUMNS = "id, first_name, last_name, email, phone, age_group, guardian_name, guardian_phone, messaging_opt_out";

export type Resolved = { recipients: Recipient[]; skipped: Skipped; matched: number };

// Works through whichever client it's given: a leader's own (so they can
// only ever address people in their scope — RLS) or the server's (automations).
export async function resolveAudience(
  supabase: SupabaseClient<Database>,
  audience: Audience,
  channel: "sms" | "email",
  templates: { self: string; guardian?: string },
  opts: { footer?: string } = {}
): Promise<Resolved> {
  let cellIds: string[] | undefined;
  if (audience.cellId) {
    const { data: inside } = await supabase.from("cells").select("id").eq("parent_id", audience.cellId);
    cellIds = [audience.cellId, ...(inside ?? []).map((c) => c.id)];
  }
  let departmentMembers: Set<string> | undefined;
  if (audience.departmentId) {
    const { data } = await supabase.from("member_departments").select("member_id").eq("department_id", audience.departmentId).limit(50000);
    departmentMembers = new Set((data ?? []).map((r) => r.member_id));
  }

  const members: MemberForMessage[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from("members").select(COLUMNS).order("id").range(from, from + 999);
    if (audience.churchId) q = q.eq("church_id", audience.churchId);
    if (cellIds) q = q.in("cell_id", cellIds);
    if (audience.ageGroup) q = q.eq("age_group", audience.ageGroup);
    if (audience.firstTimers) q = q.eq("is_visitor", true);
    if (audience.workers) q = q.eq("role", "Worker");
    const { data, error } = await q;
    if (error || !data) break;
    members.push(...data);
    if (data.length < 1000) break;
  }
  const matched = departmentMembers ? members.filter((m) => departmentMembers!.has(m.id)) : members;
  return { ...buildRecipients(matched, channel, templates, opts), matched: matched.length };
}

import "server-only";
import { createClient } from "@/lib/supabase/server";

export type FollowUpTask = {
  id: string;
  memberId: string;
  assignedTo: string;
  assignedToName: string;
  assignedByName?: string;
  dueDate: string;
  note?: string;
  status: "open" | "done" | "cancelled";
  createdAt: string;
  completedAt?: string;
};

// Open tasks the viewer can see (theirs, and for leaders, everyone's in
// their area), plus what was finished in the last 30 days.
export async function getFollowUpTasks(): Promise<FollowUpTask[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("follow_up_tasks")
    .select("id, member_id, assigned_to, assigned_by_name, due_date, note, status, created_at, completed_at")
    .or(`status.eq.open,completed_at.gte.${since}`)
    .order("due_date")
    .limit(2000);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.assigned_to))];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    assignedTo: r.assigned_to,
    assignedToName: name.get(r.assigned_to) ?? "—",
    assignedByName: r.assigned_by_name ?? undefined,
    dueDate: r.due_date,
    note: r.note ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
  }));
}

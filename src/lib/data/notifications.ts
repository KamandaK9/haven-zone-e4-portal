import "server-only";
import { createClient } from "@/lib/supabase/server";
import { can, type CurrentProfile } from "@/lib/data/get-dataset";
import type { Modules } from "@/lib/modules";

export type NotificationItem = { key: string; label: string; count: number; href: string };

// What needs this person's attention, worked out from their own view of the
// data (so every count is limited to what they're allowed to see).
export async function getNotifications(profile: CurrentProfile, modules: Modules): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const head = { count: "exact" as const, head: true };
  const [tasks, approvals, support] = await Promise.all([
    modules.attendance && can(profile, "record_follow_up")
      ? supabase.from("follow_up_tasks").select("id", head).eq("status", "open").eq("assigned_to", profile.userId)
      : null,
    modules.messaging && can(profile, "approve_messages")
      ? supabase.from("messages").select("id", head).eq("status", "pending")
      : null,
    can(profile, "manage_settings") ? supabase.from("support_requests").select("id", head).eq("status", "open") : null,
  ]);
  const items: NotificationItem[] = [
    { key: "tasks", label: "Follow-ups waiting for you", count: tasks?.count ?? 0, href: "/follow-ups" },
    { key: "approvals", label: "Messages waiting for your approval", count: approvals?.count ?? 0, href: "/messages" },
    { key: "support", label: "Open help requests", count: support?.count ?? 0, href: "/settings/support" },
  ];
  return items.filter((i) => i.count > 0);
}

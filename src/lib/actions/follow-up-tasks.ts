"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { emailIsConfigured, sendEmailOne } from "@/lib/email";
import { getSiteUrl } from "@/lib/site-url";
import { tenant } from "@/tenant";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";
import type { FollowUpOutcome } from "./follow-ups";

// Who a member's follow-up could be given to: leaders who can see them.
export async function getFollowUpAssignees(memberId: string): Promise<{ id: string; name: string; position: string }[]> {
  const profile = await getCurrentProfile();
  if (!profile || !can(profile, "record_follow_up")) return [];
  const { data } = await (await createClient()).rpc("follow_up_assignees", { p_member: memberId });
  return (data ?? []).map((r) => ({ id: r.id, name: r.full_name, position: r.position }));
}

// Giving a member's follow-up to a leader, due by a date. They're told by
// email if email is connected (a name and a link — no phone number).
export async function assignFollowUp(input: { memberId: string; assigneeId: string; dueDate: string; note: string }): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "record_follow_up")) return { ok: false, error: "Not permitted." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return { ok: false, error: "Choose a due date." };

  const supabase = await createClient();
  const { data: member } = await supabase.from("members").select("first_name, last_name").eq("id", input.memberId).maybeSingle();
  if (!member) return { ok: false, error: "That member isn't in your area." };
  const { data: open } = await supabase.from("follow_up_tasks").select("id").eq("member_id", input.memberId).eq("status", "open").maybeSingle();
  if (open) return { ok: false, error: "Someone is already assigned to follow up with them." };

  const { data: task, error } = await supabase
    .from("follow_up_tasks")
    .insert({
      zone_id: profile.zoneId,
      member_id: input.memberId,
      assigned_to: input.assigneeId,
      assigned_by: profile.userId,
      assigned_by_name: profile.fullName,
      due_date: input.dueDate,
      note: input.note.trim() || null,
    })
    .select("id")
    .single();
  if (error || !task) return { ok: false, error: error?.message.includes("row-level security") ? "That person can't see this member, so they can't follow up with them." : (error?.message ?? "Couldn't assign it.") };

  await logAudit(profile, "follow_up.assign", "Assigned a follow-up", { entity: { type: "member", id: input.memberId } });
  if (input.assigneeId !== profile.userId && emailIsConfigured()) {
    const { data: assignee } = await createAdminClient().from("profiles").select("email, full_name").eq("id", input.assigneeId).maybeSingle();
    if (assignee?.email) {
      const due = new Date(`${input.dueDate}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
      const name = `${member.first_name} ${member.last_name}`.trim();
      const link = `${await getSiteUrl()}/follow-ups`;
      await sendEmailOne({
        to: assignee.email,
        subject: `Follow-up: ${name}`,
        text: `Hi ${assignee.full_name.split(" ")[0]},\n\n${profile.fullName} asked you to follow up with ${name} by ${due}.${input.note.trim() ? `\n\n"${input.note.trim()}"` : ""}\n\nSee it in ${tenant.portalName}: ${link}`,
        html: `<div style="font-family:sans-serif;font-size:15px;line-height:1.6"><p>Hi ${assignee.full_name.split(" ")[0]},</p><p>${profile.fullName} asked you to follow up with <strong>${name}</strong> by <strong>${due}</strong>.</p>${input.note.trim() ? `<p><em>"${input.note.trim().replace(/</g, "&lt;")}"</em></p>` : ""}<p><a href="${link}">Open your follow-ups</a></p></div>`,
      }).catch(() => {});
    }
  }
  revalidatePath("/follow-ups");
  revalidatePath("/attendance");
  return { ok: true };
}

// Marking a task done by recording how it went — which is also written as
// the member's usual follow-up.
export async function completeFollowUpTask(taskId: string, outcome: FollowUpOutcome, note: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "record_follow_up")) return { ok: false, error: "Not permitted." };
  const supabase = await createClient();
  const { data: task } = await supabase.from("follow_up_tasks").select("id, member_id, status").eq("id", taskId).maybeSingle();
  if (!task || task.status !== "open") return { ok: false, error: "That follow-up isn't open any more." };

  const { data: followUp, error } = await supabase
    .from("follow_ups")
    .insert({ zone_id: profile.zoneId, member_id: task.member_id, created_by: profile.userId, outcome, note: note.trim() || null })
    .select("id")
    .single();
  if (error || !followUp) return { ok: false, error: error?.message ?? "Couldn't record it." };
  const { error: updateError } = await supabase
    .from("follow_up_tasks")
    .update({ status: "done", completed_at: new Date().toISOString(), completed_follow_up: followUp.id })
    .eq("id", taskId);
  if (updateError) return { ok: false, error: updateError.message };
  await logAudit(profile, "follow_up.complete", "Completed a follow-up", { entity: { type: "member", id: task.member_id } });
  revalidatePath("/follow-ups");
  revalidatePath("/attendance");
  revalidatePath(`/members/${task.member_id}`);
  return { ok: true };
}

export async function cancelFollowUpTask(taskId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "record_follow_up")) return { ok: false, error: "Not permitted." };
  const { data, error } = await (await createClient()).from("follow_up_tasks").update({ status: "cancelled" }).eq("id", taskId).eq("status", "open").select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "That follow-up isn't open any more." };
  revalidatePath("/follow-ups");
  revalidatePath("/attendance");
  return { ok: true };
}

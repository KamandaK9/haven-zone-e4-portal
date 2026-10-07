"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

export type FollowUpOutcome = "reached" | "no_answer" | "visited" | "other";

// Recording that someone reached out to a member flagged for missing
// services. RLS limits it to members in the leader's scope (a cell leader:
// their own cell).
export async function recordFollowUp(memberId: string, outcome: FollowUpOutcome, note: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "record_follow_up")) return { ok: false, error: "Not permitted." };

  const supabase = await createClient();
  const { error } = await supabase.from("follow_ups").insert({
    zone_id: profile.zoneId,
    member_id: memberId,
    created_by: profile.userId,
    outcome,
    note: note.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "attendance.follow_up", "Recorded a follow-up", { entity: { type: "member", id: memberId } });
  revalidatePath("/attendance");
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

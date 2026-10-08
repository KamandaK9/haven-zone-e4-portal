"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { churchToday } from "@/lib/data/attendance";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

// Taking (or correcting) a cell's register for a day: who came. One meeting
// per cell per day — saving again replaces the list. RLS limits it to the
// cells the leader covers and to members they can see.
export async function saveCellMeeting(input: { cellId: string; date: string; memberIds: string[]; note: string }): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "take_cell_attendance")) return { ok: false, error: "Not permitted." };
  const today = churchToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || input.date > today) return { ok: false, error: "Choose today or an earlier date." };
  if (Date.parse(today) - Date.parse(input.date) > 120 * 86_400_000) return { ok: false, error: "That's too long ago to change." };

  const supabase = await createClient();
  let { data: meeting } = await supabase.from("cell_meetings").select("id").eq("cell_id", input.cellId).eq("meeting_date", input.date).maybeSingle();
  if (!meeting) {
    const { data, error } = await supabase
      .from("cell_meetings")
      .insert({ zone_id: profile.zoneId, cell_id: input.cellId, meeting_date: input.date, created_by: profile.userId, created_by_name: profile.fullName, note: input.note.trim() || null })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message.includes("row-level security") ? "That isn't one of your cells." : (error?.message ?? "Couldn't save the register.") };
    meeting = data;
  } else {
    await supabase.from("cell_meetings").update({ note: input.note.trim() || null }).eq("id", meeting.id);
  }

  const { error: clearError } = await supabase.from("cell_meeting_attendance").delete().eq("meeting_id", meeting.id);
  if (clearError) return { ok: false, error: clearError.message };
  const ids = [...new Set(input.memberIds)];
  if (ids.length > 0) {
    const { error } = await supabase.from("cell_meeting_attendance").insert(ids.map((member_id) => ({ meeting_id: meeting!.id, member_id, zone_id: profile.zoneId })));
    if (error) return { ok: false, error: error.message };
  }
  await logAudit(profile, "cell.register", `Took a cell register (${ids.length} present)`, { entity: { type: "cell", id: input.cellId } });
  revalidatePath("/cell-meetings");
  return { ok: true };
}

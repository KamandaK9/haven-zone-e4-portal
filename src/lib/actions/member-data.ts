"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { MEMBER_PHOTOS_BUCKET } from "@/lib/member-photo";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

// POPIA erasure: removes a member and everything recorded about them —
// attendance, course classes, enrolments, follow-ups, giving, training and
// their photo (all cascade from the members row; the photo file is removed
// here). A member with a portal login must have it removed first, so a
// login is never left pointing at nothing. The audit entry deliberately
// doesn't name them.
export async function deleteMember(memberId: string, confirmName: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_members")) return { ok: false, error: "Not permitted." };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("first_name, last_name, profile_id, photo_path")
    .eq("id", memberId)
    .maybeSingle();
  if (!member) return { ok: false, error: "That member isn't in your scope." };
  const fullName = `${member.first_name} ${member.last_name}`.trim();
  if (confirmName.trim().toLowerCase() !== fullName.toLowerCase()) return { ok: false, error: `Type "${fullName}" to confirm.` };
  if (member.profile_id) return { ok: false, error: "They have a portal login — remove it in Settings → Team & access first." };

  const { error } = await supabase.from("members").delete().eq("id", memberId);
  if (error) return { ok: false, error: error.message };
  if (member.photo_path) await createAdminClient().storage.from(MEMBER_PHOTOS_BUCKET).remove([member.photo_path]);

  await logAudit(profile, "member.erase", "Deleted a member and all their records (erasure request)");
  revalidatePath("/", "layout");
  return { ok: true };
}

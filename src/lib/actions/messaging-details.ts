"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { toE164 } from "@/lib/messaging/text";
import { tenant } from "@/tenant";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

// A member's guardian (who their messages go to if they're a minor) and
// whether they've opted out of messages.
export async function updateMessagingDetails(
  memberId: string,
  input: { guardianName: string; guardianPhone: string; optOut: boolean }
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_members")) return { ok: false, error: "Not permitted." };
  const phone = input.guardianPhone.trim();
  if (phone && !toE164(phone, tenant.messaging?.countryCode)) return { ok: false, error: "That doesn't look like a phone number." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("members")
    .update({ guardian_name: input.guardianName.trim() || null, guardian_phone: phone || null, messaging_opt_out: input.optOut })
    .eq("id", memberId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "That member isn't in your area." };
  await logAudit(profile, "member.messaging", "Changed a member's guardian or message preferences", { entity: { type: "member", id: memberId } });
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

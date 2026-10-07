"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

// A first-timer added at check-in becomes a regular member once someone
// confirms them (after checking they aren't already on the list).
export async function confirmVisitor(memberId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_members")) return { ok: false, error: "Not permitted." };
  const supabase = await createClient();
  const { error } = await supabase.from("members").update({ is_visitor: false }).eq("id", memberId);
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "member.confirm_visitor", "Confirmed a first-timer as a member", { entity: { type: "member", id: memberId } });
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/attendance");
  return { ok: true };
}

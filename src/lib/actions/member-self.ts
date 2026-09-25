"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import type { ActionResult } from "./members";

// Updates only the caller's own linked member row, and only contact fields —
// RLS additionally scopes this to their own row (id = current_member_id()).
export async function updateOwnContactInfo(input: { email?: string; phone?: string }): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role !== "member" || !profile.linkedMemberId) {
    return { ok: false, error: "Not permitted." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
    })
    .eq("id", profile.linkedMemberId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/me");
  revalidatePath("/me/profile");
  return { ok: true };
}

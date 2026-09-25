"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

// RLS (churches_update) is what actually enforces scope — a Governor can
// only rename their own chapter, a Sub Zone Governor any chapter in their
// sub-zone, and so on. This just checks the coarse capability up front so
// the error message is clearer than a silent "0 rows updated".
export async function renameChapter(churchId: string, name: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_members")) return { ok: false, error: "Not permitted." };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "A name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("churches")
    .update({ name: trimmed })
    .eq("id", churchId)
    .eq("zone_id", profile.zoneId)
    .select("id, name");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "You don't have access to rename this chapter." };
  }

  await logAudit(profile, "church.rename", `Renamed a chapter to "${trimmed}"`);
  revalidatePath("/", "layout");
  return { ok: true };
}

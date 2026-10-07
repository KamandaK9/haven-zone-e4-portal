"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";
import { labels, lower } from "@/lib/labels";

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
    return { ok: false, error: `You don't have access to rename this ${lower(labels.location)}.` };
  }

  await logAudit(profile, "church.rename", `Renamed a ${lower(labels.location)} to "${trimmed}"`);
  revalidatePath("/", "layout");
  return { ok: true };
}

// Adding a location after setup. RLS (churches_insert) limits it to the
// zone's super admins; this checks the same up front for a clearer error.
export async function addLocation(countryId: string, name: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role !== "super_admin") return { ok: false, error: `Only the main admin can add a ${lower(labels.location)}.` };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "A name is required." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("churches").select("id").eq("zone_id", profile.zoneId).ilike("name", trimmed);
  if (existing && existing.length > 0) return { ok: false, error: `There's already a ${lower(labels.location)} called "${trimmed}".` };

  const { error } = await supabase.from("churches").insert({ zone_id: profile.zoneId, country_id: countryId, name: trimmed });
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "church.create", `Added the ${lower(labels.location)} "${trimmed}"`);
  revalidatePath("/", "layout");
  return { ok: true };
}

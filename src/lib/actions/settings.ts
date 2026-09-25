"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import { CURRENCIES } from "@/lib/currency";
import type { ActionResult } from "./members";

export async function updateHiddenNavItems(hiddenNavItems: string[]): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role !== "super_admin") return { ok: false, error: "Not permitted." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ hidden_nav_items: hiddenNavItems })
    .eq("id", profile.userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateDisplayCurrency(currency: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_access")) return { ok: false, error: "Not permitted." };
  if (!CURRENCIES.some((c) => c.code === currency)) return { ok: false, error: "Unknown currency." };

  const supabase = await createClient();
  const { error } = await supabase.from("zones").update({ display_currency: currency }).eq("id", profile.zoneId);

  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "settings.update_currency", `Changed display currency to ${currency}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

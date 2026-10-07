"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { createPrivateUpload, pathIsUnder, removeFiles } from "@/lib/storage/private-files";
import { CHECK_IN_SCREEN_BUCKET } from "@/lib/check-in/screen";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!can(profile, "manage_access")) return { ok: false as const, error: "Only admins can change the check-in screen." };
  return { ok: true as const, profile };
}

export async function createCheckInBackgroundUpload(file: { name: string; size: number; type: string }) {
  const auth = await admin();
  if (!auth.ok) return auth;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { ok: false as const, error: "Use a JPG, PNG or WebP image." };
  if (file.size > 10 * 1024 * 1024) return { ok: false as const, error: "That image is over 10 MB." };
  return createPrivateUpload(CHECK_IN_SCREEN_BUCKET, auth.profile.zoneId, file.name);
}

// `background`: a new upload's path, null to remove the image, or undefined
// to keep the current one.
export async function saveCheckInScreen(input: { title: string; tagline: string; background?: string | null }): Promise<ActionResult> {
  const auth = await admin();
  if (!auth.ok) return auth;
  const { profile } = auth;
  if (input.background && !pathIsUnder(input.background, profile.zoneId)) return { ok: false, error: "That upload isn't yours." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("check_in_screen").select("background_path").eq("zone_id", profile.zoneId).maybeSingle();
  const { error } = await supabase.from("check_in_screen").upsert({
    zone_id: profile.zoneId,
    title: input.title.trim() || null,
    tagline: input.tagline.trim() || null,
    ...(input.background !== undefined ? { background_path: input.background } : {}),
    updated_by: profile.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  if (input.background !== undefined && current?.background_path && current.background_path !== input.background) {
    await removeFiles(CHECK_IN_SCREEN_BUCKET, [current.background_path]);
  }
  await logAudit(profile, "check_in.screen", "Changed the self check-in screen");
  revalidatePath("/settings/check-in");
  revalidatePath("/check-in/kiosk");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { checkPhotoUpload, MEMBER_PHOTOS_BUCKET } from "@/lib/member-photo";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

// A member manages their own photo; staff with manage_members can set one
// for a member in their scope too (it's roster data, same as everything
// else they maintain there). RLS on the members-table write is what
// actually enforces the scope — this only decides whether it's worth
// minting a storage upload token at all.
async function checkAccess(memberId: string): Promise<{ ok: true; zoneId: string; self: boolean } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const self = profile.linkedMemberId === memberId;
  if (!self && !can(profile, "manage_members")) return { ok: false, error: "Not permitted." };

  const supabase = await createClient();
  const { data } = await supabase.from("members").select("id, zone_id").eq("id", memberId).maybeSingle();
  if (!data || data.zone_id !== profile.zoneId) return { ok: false, error: "Member not found, or not in your scope." };
  return { ok: true, zoneId: data.zone_id, self };
}

export type PhotoUploadTokenResult = { ok: true; path: string; token: string } | { ok: false; error: string };

export async function createMemberPhotoUploadToken(
  memberId: string,
  file: { name: string; type: string; size: number }
): Promise<PhotoUploadTokenResult> {
  const access = await checkAccess(memberId);
  if (!access.ok) return access;

  const problem = checkPhotoUpload(file.type, file.size);
  if (problem) return { ok: false, error: problem };

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${access.zoneId}/${memberId}/${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await createAdminClient().storage.from(MEMBER_PHOTOS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not start the upload." };
  return { ok: true, path, token: data.token };
}

function publicUrl(path: string): string {
  return createAdminClient().storage.from(MEMBER_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

function pathBelongsTo(path: string, zoneId: string, memberId: string): boolean {
  return path.startsWith(`${zoneId}/${memberId}/`) && !path.includes("..");
}

export async function setMemberPhoto(memberId: string, path: string): Promise<ActionResult> {
  const access = await checkAccess(memberId);
  if (!access.ok) return access;
  if (!pathBelongsTo(path, access.zoneId, memberId)) return { ok: false, error: "That upload doesn't belong to this member." };

  const supabase = await createClient();
  const { data: existing } = await supabase.from("members").select("photo_path").eq("id", memberId).maybeSingle();

  const { error } = await supabase.from("members").update({ photo_url: publicUrl(path), photo_path: path }).eq("id", memberId);
  if (error) return { ok: false, error: error.message };

  if (existing?.photo_path && existing.photo_path !== path) {
    await createAdminClient().storage.from(MEMBER_PHOTOS_BUCKET).remove([existing.photo_path]);
  }

  const profile = await getCurrentProfile();
  if (profile && !access.self) await logAudit(profile, "member.photo", "Changed a member's profile photo");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeMemberPhoto(memberId: string): Promise<ActionResult> {
  const access = await checkAccess(memberId);
  if (!access.ok) return access;

  const supabase = await createClient();
  const { data: existing } = await supabase.from("members").select("photo_path").eq("id", memberId).maybeSingle();

  const { error } = await supabase.from("members").update({ photo_url: null, photo_path: null }).eq("id", memberId);
  if (error) return { ok: false, error: error.message };
  if (existing?.photo_path) await createAdminClient().storage.from(MEMBER_PHOTOS_BUCKET).remove([existing.photo_path]);

  const profile = await getCurrentProfile();
  if (profile && !access.self) await logAudit(profile, "member.photo", "Removed a member's profile photo");
  revalidatePath("/", "layout");
  return { ok: true };
}

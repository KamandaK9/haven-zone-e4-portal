"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { createPrivateUpload, pathIsUnder, removeFiles } from "@/lib/storage/private-files";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";
import { RESOURCES_BUCKET } from "@/lib/resources/bucket";

const MAX_BYTES = 50 * 1024 * 1024;
export type ResourceKind = "logo" | "brand" | "press";

async function admin() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!can(profile, "manage_access")) return { ok: false as const, error: "Only admins can change resources." };
  return { ok: true as const, profile };
}

// A signed upload URL in this zone's folder; the browser uploads straight
// to storage (Next's server-action body limit is far below a logo pack).
export async function createResourceUpload(file: { name: string; size: number }) {
  const auth = await admin();
  if (!auth.ok) return auth;
  if (file.size > MAX_BYTES) return { ok: false as const, error: "That file is over 50 MB." };
  return createPrivateUpload(RESOURCES_BUCKET, auth.profile.zoneId, file.name);
}

export async function saveResource(input: {
  kind: ResourceKind;
  title: string;
  description?: string;
  path: string;
  fileName: string;
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
}): Promise<ActionResult> {
  const auth = await admin();
  if (!auth.ok) return auth;
  const { profile } = auth;
  if (!pathIsUnder(input.path, profile.zoneId)) return { ok: false, error: "That upload isn't yours." };
  if (!input.title.trim()) return { ok: false, error: "Give it a title." };
  const supabase = await createClient();
  const { error } = await supabase.from("resources").insert({
    zone_id: profile.zoneId,
    kind: input.kind,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    file_path: input.path,
    file_name: input.fileName,
    mime: input.mime,
    bytes: input.bytes,
    width: input.width ?? null,
    height: input.height ?? null,
    uploaded_by: profile.userId,
  });
  if (error) {
    await removeFiles(RESOURCES_BUCKET, [input.path]);
    return { ok: false, error: error.message };
  }
  await logAudit(profile, "resource.add", `Added "${input.title.trim()}" to resources`);
  revalidatePath("/resources");
  return { ok: true };
}

export async function deleteResource(id: string): Promise<ActionResult> {
  const auth = await admin();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase.from("resources").delete().eq("id", id).select("file_path, title");
  if (error) return { ok: false, error: error.message };
  if (data?.[0]) {
    await removeFiles(RESOURCES_BUCKET, [data[0].file_path]);
    await logAudit(auth.profile, "resource.remove", `Removed "${data[0].title}" from resources`);
  }
  revalidatePath("/resources");
  return { ok: true };
}

export async function saveLogoGuidelines(text: string): Promise<ActionResult> {
  const auth = await admin();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { error } = await supabase.from("resource_settings").upsert({
    zone_id: auth.profile.zoneId,
    logo_guidelines: text.trim() || null,
    updated_by: auth.profile.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/resources");
  return { ok: true };
}

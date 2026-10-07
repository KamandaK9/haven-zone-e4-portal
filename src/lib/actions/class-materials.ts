"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { createPrivateUpload, pathIsUnder, removeFiles } from "@/lib/storage/private-files";
import { CLASS_MATERIALS_BUCKET } from "@/lib/courses/materials-bucket";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

async function manager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!can(profile, "manage_courses")) return { ok: false as const, error: "Only whoever runs the course can add materials." };
  return { ok: true as const, profile };
}

export async function createClassMaterialUpload(file: { name: string; size: number }) {
  const auth = await manager();
  if (!auth.ok) return auth;
  if (file.size > 50 * 1024 * 1024) return { ok: false as const, error: "That file is over 50 MB — add it as a link instead." };
  return createPrivateUpload(CLASS_MATERIALS_BUCKET, auth.profile.zoneId, file.name);
}

export async function addClassMaterial(input: {
  classId: string;
  title: string;
  url?: string;
  file?: { path: string; name: string; mime: string; bytes: number };
}): Promise<ActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const { profile } = auth;
  if (!input.title.trim()) return { ok: false, error: "Give it a title." };
  if (input.file && !pathIsUnder(input.file.path, profile.zoneId)) return { ok: false, error: "That upload isn't yours." };
  const url = input.url?.trim();
  if (!input.file && !(url && /^https?:\/\//i.test(url))) return { ok: false, error: "Add a file, or a link starting with https://" };

  const supabase = await createClient();
  const { error } = await supabase.from("class_materials").insert({
    zone_id: profile.zoneId,
    class_id: input.classId,
    title: input.title.trim(),
    ...(input.file
      ? { file_path: input.file.path, file_name: input.file.name, mime: input.file.mime, bytes: input.file.bytes }
      : { url }),
    created_by: profile.userId,
  });
  if (error) {
    if (input.file) await removeFiles(CLASS_MATERIALS_BUCKET, [input.file.path]);
    return { ok: false, error: error.message };
  }
  await logAudit(profile, "course.material_add", `Added "${input.title.trim()}" to a class`);
  revalidatePath("/courses", "layout");
  return { ok: true };
}

export async function removeClassMaterial(id: string): Promise<ActionResult> {
  const auth = await manager();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase.from("class_materials").delete().eq("id", id).select("file_path, title");
  if (error) return { ok: false, error: error.message };
  if (data?.[0]?.file_path) await removeFiles(CLASS_MATERIALS_BUCKET, [data[0].file_path]);
  if (data?.[0]) await logAudit(auth.profile, "course.material_remove", `Removed "${data[0].title}" from a class`);
  revalidatePath("/courses", "layout");
  return { ok: true };
}

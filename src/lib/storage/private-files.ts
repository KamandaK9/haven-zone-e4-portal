import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Files in a private bucket: nobody gets a permanent link. Callers check
// permission first (usually by reading the owning row under the caller's
// RLS), then use these to hand out short-lived signed URLs. The browser
// uploads straight to storage, which avoids Next's server-action body limit.

const READ_URL_SECONDS = 5 * 60;

export function safeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
}

// A path is only accepted under the folder it was issued for, so a caller
// can't attach someone else's upload.
export function pathIsUnder(path: string, folder: string): boolean {
  return path.startsWith(`${folder}/`) && !path.includes("..");
}

export async function createPrivateUpload(
  bucket: string,
  folder: string,
  fileName: string
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const path = `${folder}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not start the upload." };
  return { ok: true, path, token: data.token };
}

// Signed read URLs for many paths at once; paths that fail are left out.
export async function signedReadUrls(bucket: string, paths: string[], download = false): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data } = await createAdminClient().storage.from(bucket).createSignedUrls(paths, READ_URL_SECONDS, { download });
  for (const item of data ?? []) if (item.path && item.signedUrl) out.set(item.path, item.signedUrl);
  return out;
}

export async function removeFiles(bucket: string, paths: string[]): Promise<void> {
  if (paths.length > 0) await createAdminClient().storage.from(bucket).remove(paths);
}

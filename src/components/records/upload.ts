"use client";

import { createClient } from "@/lib/supabase/client";
import { createRecordUpload, type UploadedFile } from "@/lib/actions/records";
import type { RecordUploadPurpose } from "@/lib/records/authorise";
import { RECORDS_BUCKET } from "@/lib/records/files";

// Phones often hand over HEIC photos (and some browsers other files) with no
// MIME type; fall back to the extension so the server can check it.
const BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function mimeOf(file: File): string {
  return file.type || BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""] || "application/octet-stream";
}

// Uploads straight to private storage, one signed URL per file. Returns the
// uploaded files for the save action to attach, or the first error.
export async function uploadRecordFiles(
  churchId: string,
  purpose: RecordUploadPurpose,
  files: File[]
): Promise<{ ok: true; files: UploadedFile[] } | { ok: false; error: string }> {
  const uploaded: UploadedFile[] = [];
  for (const file of files) {
    const type = mimeOf(file);
    const token = await createRecordUpload(churchId, purpose, { name: file.name, type, size: file.size });
    if (!token.ok) return { ok: false, error: `${file.name}: ${token.error}` };
    const { error } = await createClient().storage.from(RECORDS_BUCKET).uploadToSignedUrl(token.path, token.token, file, { contentType: type });
    if (error) return { ok: false, error: `${file.name}: ${error.message}` };
    uploaded.push({ path: token.path, name: file.name, type, size: file.size });
  }
  return { ok: true, files: uploaded };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { authorise, type RecordUploadPurpose } from "@/lib/records/authorise";
import { checkRecordFile, RECORDS_BUCKET } from "@/lib/records/files";
import { createPrivateUpload, pathIsUnder, removeFiles } from "@/lib/storage/private-files";
import type { ChapterRecordKind } from "@/lib/supabase/types";
import { tenant } from "@/tenant";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

export async function createRecordUpload(
  churchId: string,
  purpose: RecordUploadPurpose,
  file: { name: string; type: string; size: number }
): Promise<{ ok: true; path: string; token: string } | { ok: false; error: string }> {
  const problem = checkRecordFile(file.type, file.size);
  if (problem) return { ok: false, error: problem };
  const auth = await authorise(churchId, purpose);
  if (!auth.ok) return auth;
  return createPrivateUpload(RECORDS_BUCKET, auth.folder, file.name);
}

const KIND_LABEL: Record<ChapterRecordKind, string> = {
  minutes: "minutes",
  correspondence: "correspondence",
  bank_advice: "bank advice",
};

export type UploadedFile = { path: string; name: string; type: string; size: number };

export type RecordInput = {
  id?: string;
  churchId: string;
  kind: ChapterRecordKind;
  title: string;
  recordDate: string;
  body?: string;
  meetingType?: string;
  eventId?: string | null;
  direction?: "in" | "out";
  counterparty?: string;
  reference?: string;
  account?: string;
  amount?: number | null;
  // Newly uploaded files to attach.
  files: UploadedFile[];
};

function validate(input: RecordInput): string | null {
  if (!input.title.trim()) return "Give it a title.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.recordDate)) return "Pick a date.";
  if (input.kind === "correspondence" && input.direction !== "in" && input.direction !== "out") return "Say whether it was received or sent.";
  if (input.kind === "bank_advice") {
    if (!tenant.records.bankAccounts.some((a) => a.key === input.account)) return "Pick the account.";
    if (!(typeof input.amount === "number" && input.amount > 0)) return "Enter the amount.";
  }
  for (const f of input.files) {
    const problem = checkRecordFile(f.type, f.size);
    if (problem) return `${f.name}: ${problem}`;
  }
  return null;
}

// Only the columns that belong to the kind are kept; the rest are nulled.
function columns(input: RecordInput) {
  const text = (v?: string) => v?.trim() || null;
  return {
    title: input.title.trim(),
    record_date: input.recordDate,
    body: text(input.body),
    meeting_type: input.kind === "minutes" ? text(input.meetingType) : null,
    event_id: input.kind === "minutes" ? input.eventId || null : null,
    direction: input.kind === "correspondence" ? (input.direction ?? null) : null,
    counterparty: input.kind === "correspondence" ? text(input.counterparty) : null,
    reference: input.kind === "minutes" ? null : text(input.reference),
    account: input.kind === "bank_advice" ? (input.account ?? null) : null,
    amount: input.kind === "bank_advice" ? (input.amount ?? null) : null,
  };
}

export async function saveRecord(input: RecordInput): Promise<ActionResult> {
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };
  const auth = await authorise(input.churchId, input.kind);
  if (!auth.ok) return auth;
  const { profile, supabase, folder } = auth;
  if (input.files.some((f) => !pathIsUnder(f.path, folder))) return { ok: false, error: "That upload doesn't belong to this chapter." };

  let recordId = input.id;
  if (recordId) {
    const { data, error } = await supabase
      .from("chapter_records")
      .update({ ...columns(input), updated_at: new Date().toISOString() })
      .eq("id", recordId)
      .eq("church_id", input.churchId)
      .eq("kind", input.kind)
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: "That record no longer exists." };
  } else {
    const { data, error } = await supabase
      .from("chapter_records")
      .insert({ zone_id: profile.zoneId, church_id: input.churchId, kind: input.kind, created_by: profile.userId, ...columns(input) })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Could not save." };
    recordId = data.id;
  }

  if (input.files.length > 0) {
    const { error } = await supabase.from("chapter_record_files").insert(
      input.files.map((f) => ({
        record_id: recordId!,
        zone_id: profile.zoneId,
        storage_path: f.path,
        file_name: f.name.slice(0, 200),
        mime_type: f.type,
        size_bytes: f.size,
      }))
    );
    if (error) return { ok: false, error: `Saved, but attaching the files failed: ${error.message}` };
  }

  await logAudit(profile, input.id ? "record.update" : "record.create", `${input.id ? "Edited" : "Filed"} ${KIND_LABEL[input.kind]}: "${input.title.trim()}"`);
  revalidatePath("/records");
  return { ok: true };
}

export async function deleteRecord(recordId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  // Read under RLS first: finding it is the permission check.
  const { data: record } = await supabase
    .from("chapter_records")
    .select("kind, title, chapter_record_files(storage_path)")
    .eq("id", recordId)
    .maybeSingle();
  if (!record) return { ok: false, error: "That record no longer exists." };

  const { error } = await supabase.from("chapter_records").delete().eq("id", recordId);
  if (error) return { ok: false, error: error.message };
  const files = record.chapter_record_files ?? [];
  await removeFiles(RECORDS_BUCKET, files.map((f) => f.storage_path));

  await logAudit(profile, "record.delete", `Deleted ${KIND_LABEL[record.kind as ChapterRecordKind]}: "${record.title}"`);
  revalidatePath("/records");
  return { ok: true };
}

export async function removeRecordFile(fileId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const { data: file } = await supabase.from("chapter_record_files").select("storage_path, file_name").eq("id", fileId).maybeSingle();
  if (!file) return { ok: false, error: "That file no longer exists." };

  const { error } = await supabase.from("chapter_record_files").delete().eq("id", fileId);
  if (error) return { ok: false, error: error.message };
  await removeFiles(RECORDS_BUCKET, [file.storage_path]);

  await logAudit(profile, "record.file_remove", `Removed "${file.file_name}"`);
  revalidatePath("/records");
  return { ok: true };
}

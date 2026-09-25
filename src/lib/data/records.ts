import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChapterRecordKind, ChequeStatus } from "@/lib/supabase/types";

export type RecordFile = { id: string; fileName: string; mimeType: string; sizeBytes: number };

export type ChapterRecord = {
  id: string;
  churchId: string;
  kind: ChapterRecordKind;
  title: string;
  recordDate: string;
  body?: string;
  meetingType?: string;
  eventId?: string;
  direction?: "in" | "out";
  counterparty?: string;
  reference?: string;
  account?: string;
  amount?: number;
  files: RecordFile[];
};

export type Cheque = {
  id: string;
  churchId: string;
  account: string;
  chequeNumber: string;
  issueDate: string;
  payee: string;
  amount: number;
  purpose?: string;
  status: ChequeStatus;
  ledgerEntryId?: string;
  stubFileName?: string;
};

// Chapters whose records the viewer can reach: churches RLS already limits
// leaders to their scope.
export async function getRecordChapters(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("churches").select("id, name").order("name");
  return data ?? [];
}

// null = the tables don't exist yet (migration not applied).
export async function getChapterRecords(churchId: string, kind: ChapterRecordKind): Promise<ChapterRecord[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapter_records")
    .select("*, chapter_record_files(id, file_name, mime_type, size_bytes)")
    .eq("church_id", churchId)
    .eq("kind", kind)
    .order("record_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return null;

  return data.map((r) => ({
    id: r.id,
    churchId: r.church_id,
    kind: r.kind,
    title: r.title,
    recordDate: r.record_date,
    body: r.body ?? undefined,
    meetingType: r.meeting_type ?? undefined,
    eventId: r.event_id ?? undefined,
    direction: r.direction ?? undefined,
    counterparty: r.counterparty ?? undefined,
    reference: r.reference ?? undefined,
    account: r.account ?? undefined,
    amount: r.amount === null ? undefined : Number(r.amount),
    files: (r.chapter_record_files ?? []).map((f) => ({ id: f.id, fileName: f.file_name, mimeType: f.mime_type, sizeBytes: Number(f.size_bytes) })),
  }));
}

export async function getChapterCheques(churchId: string): Promise<Cheque[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cheques")
    .select("*")
    .eq("church_id", churchId)
    .order("issue_date", { ascending: false })
    .order("cheque_number", { ascending: false });
  if (error) return null;
  return data.map((c) => ({
    id: c.id,
    churchId: c.church_id,
    account: c.account,
    chequeNumber: c.cheque_number,
    issueDate: c.issue_date,
    payee: c.payee,
    amount: Number(c.amount),
    purpose: c.purpose ?? undefined,
    status: c.status,
    ledgerEntryId: c.ledger_entry_id ?? undefined,
    stubFileName: c.stub_file_name ?? undefined,
  }));
}

// Recent meetings on the chapter's calendar, for linking minutes to them.
export async function getChapterMeetings(churchId: string): Promise<{ id: string; title: string; date: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, date")
    .eq("church_id", churchId)
    .eq("type", "meeting")
    .order("date", { ascending: false })
    .limit(50);
  return data ?? [];
}

"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, FileText, Paperclip, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { deleteRecord, removeRecordFile, saveRecord } from "@/lib/actions/records";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import type { ChapterRecord } from "@/lib/data/records";
import { formatBytes, RECORD_FILE_ACCEPT } from "@/lib/records/files";
import type { ChapterRecordKind } from "@/lib/supabase/types";
import { cn, pluralize } from "@/lib/utils";
import { uploadRecordFiles } from "./upload";

export type RegisterOptions = {
  accounts: readonly { key: string; label: string }[];
  meetingTypes: readonly string[];
  meetings: { id: string; title: string; date: string }[];
  currency: CurrencyCode;
  rates: Record<string, number>;
};

const COPY: Record<ChapterRecordKind, { noun: string; add: string; titleLabel: string; titlePlaceholder: string; bodyLabel: string; empty: string }> = {
  minutes: {
    noun: "minutes",
    add: "File minutes",
    titleLabel: "Meeting",
    titlePlaceholder: "e.g. March executive meeting",
    bodyLabel: "Attendance, decisions and action points",
    empty: "No minutes filed yet.",
  },
  correspondence: {
    noun: "letter",
    add: "File a letter",
    titleLabel: "Subject",
    titlePlaceholder: "e.g. Request to host the convention",
    bodyLabel: "Summary",
    empty: "No correspondence filed yet.",
  },
  bank_advice: {
    noun: "bank advice",
    add: "File a bank advice",
    titleLabel: "Description",
    titlePlaceholder: "e.g. Monthly transfer to head office",
    bodyLabel: "Notes",
    empty: "No bank advices filed yet.",
  },
};

const NONE = "__none";
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {error}
    </div>
  );
}

function RecordDialog({
  kind,
  churchId,
  record,
  options,
  onClose,
}: {
  kind: ChapterRecordKind;
  churchId: string;
  record?: ChapterRecord;
  options: RegisterOptions;
  onClose: () => void;
}) {
  const router = useRouter();
  const copy = COPY[kind];
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: record?.title ?? "",
    recordDate: record?.recordDate ?? today(),
    body: record?.body ?? "",
    meetingType: record?.meetingType ?? "",
    eventId: record?.eventId ?? "",
    direction: record?.direction ?? ("in" as "in" | "out"),
    counterparty: record?.counterparty ?? "",
    reference: record?.reference ?? "",
    account: record?.account ?? options.accounts[0]?.key ?? "",
    amount: record?.amount !== undefined ? String(record.amount) : "",
  });
  const [newFiles, setNewFiles] = useState<File[]>([]);
  // Files detached while the dialog is open (the record prop is a snapshot).
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const existingFiles = (record?.files ?? []).filter((f) => !removed.has(f.id));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setBusy(true);
    setError(null);
    const uploaded = await uploadRecordFiles(churchId, kind, newFiles);
    if (!uploaded.ok) {
      setBusy(false);
      return setError(uploaded.error);
    }
    const result = await saveRecord({
      id: record?.id,
      churchId,
      kind,
      ...form,
      eventId: form.eventId || null,
      amount: form.amount === "" ? null : Number(form.amount),
      files: uploaded.files,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!record) return;
    setBusy(true);
    const result = await deleteRecord(record.id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onClose();
    router.refresh();
  }

  async function detach(fileId: string) {
    setBusy(true);
    const result = await removeRecordFile(fileId);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setRemoved((r) => new Set(r).add(fileId));
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{record ? `Edit ${copy.noun}` : copy.add}</DialogTitle>
          <DialogDescription>Attach the scan or photo so the paper copy is never the only one.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {kind === "correspondence" && (
            <div className="grid grid-cols-2 gap-2">
              {(["in", "out"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ direction: d })}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm",
                    form.direction === d ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-muted"
                  )}
                >
                  {d === "in" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  {d === "in" ? "Received" : "Sent"}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="space-y-1.5">
              <Label htmlFor="rec-title">{copy.titleLabel}</Label>
              <Input id="rec-title" placeholder={copy.titlePlaceholder} value={form.title} onChange={(e) => set({ title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rec-date">Date</Label>
              <Input id="rec-date" type="date" value={form.recordDate} onChange={(e) => set({ recordDate: e.target.value })} />
            </div>
          </div>

          {kind === "minutes" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rec-type">Meeting type</Label>
                <Input id="rec-type" list="meeting-types" value={form.meetingType} onChange={(e) => set({ meetingType: e.target.value })} />
                <datalist id="meeting-types">
                  {options.meetingTypes.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              {options.meetings.length > 0 && (
                <div className="space-y-1.5">
                  <Label>On the calendar as</Label>
                  <Select value={form.eventId || NONE} onValueChange={(v) => set({ eventId: v === NONE ? "" : v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not linked</SelectItem>
                      {options.meetings.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.title} · {formatDate(m.date)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {kind === "correspondence" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rec-party">{form.direction === "in" ? "From" : "To"}</Label>
                <Input id="rec-party" value={form.counterparty} onChange={(e) => set({ counterparty: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-ref">Reference</Label>
                <Input id="rec-ref" value={form.reference} onChange={(e) => set({ reference: e.target.value })} />
              </div>
            </div>
          )}

          {kind === "bank_advice" && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-3">
                <Label>Account</Label>
                <Select value={form.account} onValueChange={(v) => set({ account: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {options.accounts.map((a) => (
                      <SelectItem key={a.key} value={a.key}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-amount">Amount (USD)</Label>
                <Input id="rec-amount" type="number" inputMode="decimal" min={0} step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="rec-ref">Bank reference</Label>
                <Input id="rec-ref" value={form.reference} onChange={(e) => set({ reference: e.target.value })} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="rec-body">{copy.bodyLabel}</Label>
            <Textarea id="rec-body" rows={kind === "minutes" ? 6 : 3} value={form.body} onChange={(e) => set({ body: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Paperwork</Label>
            {existingFiles.length > 0 && (
              <ul className="divide-y rounded-lg border text-sm">
                {existingFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <a href={`/api/records/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                      {f.fileName}
                    </a>
                    <span className="text-xs text-muted-foreground">{formatBytes(f.sizeBytes)}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => detach(f.id)} disabled={busy} aria-label={`Remove ${f.fileName}`}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {newFiles.length > 0 && (
              <ul className="space-y-1 text-sm">
                {newFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{f.name}</span>
                    <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setNewFiles((fs) => fs.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={RECORD_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                setNewFiles((fs) => [...fs, ...Array.from(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInput.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" />
              Attach files
            </Button>
          </div>

          <ErrorNote error={error} />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {record ? (
            confirmDelete ? (
              <Button type="button" variant="destructive" onClick={remove} disabled={busy}>
                Delete for good
              </Button>
            ) : (
              <Button type="button" variant="ghost" className="gap-1.5 text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={busy || !form.title.trim()}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecordRegister({
  kind,
  churchId,
  records,
  options,
}: {
  kind: ChapterRecordKind;
  churchId: string;
  records: ChapterRecord[];
  options: RegisterOptions;
}) {
  const copy = COPY[kind];
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string>("all");
  const [open, setOpen] = useState<ChapterRecord | "new" | null>(null);

  const years = useMemo(() => [...new Set(records.map((r) => r.recordDate.slice(0, 4)))].sort().reverse(), [records]);
  const accountLabel = (key?: string) => options.accounts.find((a) => a.key === key)?.label ?? key ?? "";
  const shown = records.filter((r) => {
    if (year !== "all" && !r.recordDate.startsWith(year)) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [r.title, r.body, r.meetingType, r.counterparty, r.reference, accountLabel(r.account)]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        {years.length > 1 && (
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button className="gap-1.5 sm:ml-auto" onClick={() => setOpen("new")}>
          <Plus className="h-4 w-4" />
          {copy.add}
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          {records.length === 0 ? copy.empty : "Nothing matches."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40">
                <span className="w-24 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{formatDate(r.recordDate)}</span>
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex items-center gap-1.5 font-medium">
                    {kind === "correspondence" &&
                      (r.direction === "out" ? (
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Sent" />
                      ) : (
                        <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Received" />
                      ))}
                    <span className="truncate">{r.title}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {kind === "minutes" && (r.meetingType ?? "Meeting")}
                    {kind === "correspondence" &&
                      [r.direction === "out" ? `To ${r.counterparty ?? "—"}` : `From ${r.counterparty ?? "—"}`, r.reference].filter(Boolean).join(" · ")}
                    {kind === "bank_advice" &&
                      [accountLabel(r.account), r.amount !== undefined ? formatMoney(r.amount, options.currency, options.rates) : null, r.reference]
                        .filter(Boolean)
                        .join(" · ")}
                  </span>
                </span>
                {r.files.length > 0 && (
                  <span className="flex shrink-0 items-center gap-1 pt-0.5 text-xs text-muted-foreground" title={pluralize(r.files.length, "file")}>
                    <Paperclip className="h-3.5 w-3.5" />
                    {r.files.length}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <RecordDialog
          key={open === "new" ? "new" : open.id}
          kind={kind}
          churchId={churchId}
          record={open === "new" ? undefined : open}
          options={options}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, BookOpenText, FileText, Paperclip, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { deleteCheque, saveCheque } from "@/lib/actions/cheques";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import type { Cheque } from "@/lib/data/records";
import { chequeGaps, nextChequeNumber } from "@/lib/records/cheques";
import { RECORD_FILE_ACCEPT } from "@/lib/records/files";
import type { ChequeStatus } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { uploadRecordFiles } from "./upload";

type Account = { key: string; label: string };

const STATUS_LABEL: Record<ChequeStatus, string> = { issued: "Issued", cleared: "Cleared", cancelled: "Cancelled", void: "Void" };
const STATUS_STYLE: Record<ChequeStatus, string> = {
  issued: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  cleared: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground line-through",
  void: "bg-muted text-muted-foreground line-through",
};
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function ChequeDialog({
  churchId,
  cheque,
  accounts,
  numbersByAccount,
  onClose,
}: {
  churchId: string;
  cheque?: Cheque;
  accounts: readonly Account[];
  numbersByAccount: Map<string, string[]>;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const firstAccount = accounts[0]?.key ?? "";
  const [form, setForm] = useState({
    account: cheque?.account ?? firstAccount,
    chequeNumber: cheque?.chequeNumber ?? nextChequeNumber(numbersByAccount.get(firstAccount) ?? []),
    issueDate: cheque?.issueDate ?? today(),
    payee: cheque?.payee ?? "",
    amount: cheque ? String(cheque.amount) : "",
    purpose: cheque?.purpose ?? "",
    status: cheque?.status ?? ("issued" as ChequeStatus),
    recordInLedger: true,
  });
  const [stub, setStub] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const unpaid = form.status === "cancelled" || form.status === "void";

  async function save() {
    setBusy(true);
    setError(null);
    let uploadedStub = null;
    if (stub) {
      const up = await uploadRecordFiles(churchId, "cheque", [stub]);
      if (!up.ok) {
        setBusy(false);
        return setError(up.error);
      }
      uploadedStub = up.files[0];
    }
    const result = await saveCheque({
      id: cheque?.id,
      churchId,
      account: form.account,
      chequeNumber: form.chequeNumber,
      issueDate: form.issueDate,
      payee: form.payee,
      amount: Number(form.amount),
      purpose: form.purpose,
      status: form.status,
      recordInLedger: !cheque && form.recordInLedger,
      stub: uploadedStub,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onClose();
    router.refresh();
  }

  async function remove() {
    if (!cheque) return;
    setBusy(true);
    const result = await deleteCheque(cheque.id, churchId);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{cheque ? `Cheque ${cheque.chequeNumber}` : "Record a cheque"}</DialogTitle>
          <DialogDescription>Fill it in from the stub, exactly as written.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <div className="space-y-1.5">
              <Label>Drawn on</Label>
              <Select
                value={form.account}
                onValueChange={(v) =>
                  set({ account: v, ...(cheque ? {} : { chequeNumber: nextChequeNumber(numbersByAccount.get(v) ?? []) }) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.key} value={a.key}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chq-no">Cheque no.</Label>
              <Input id="chq-no" inputMode="numeric" value={form.chequeNumber} onChange={(e) => set({ chequeNumber: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="space-y-1.5">
              <Label htmlFor="chq-payee">Pay</Label>
              <Input id="chq-payee" value={form.payee} onChange={(e) => set({ payee: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chq-date">Date</Label>
              <Input id="chq-date" type="date" value={form.issueDate} onChange={(e) => set({ issueDate: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="chq-amount">Amount (USD)</Label>
              <Input id="chq-amount" type="number" inputMode="decimal" min={0} step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chq-purpose">For</Label>
              <Input id="chq-purpose" placeholder="What the payment was for" value={form.purpose} onChange={(e) => set({ purpose: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set({ status: v as ChequeStatus })}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as ChequeStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cheque?.ledgerEntryId && unpaid && (
              <p className="text-xs text-amber-700 dark:text-amber-400">Saving removes this cheque&apos;s payment from the ledger.</p>
            )}
          </div>

          {!cheque && (
            <label className={cn("flex items-start gap-2.5 rounded-lg border p-3 text-sm", unpaid && "opacity-50")}>
              <Checkbox checked={form.recordInLedger && !unpaid} disabled={unpaid} onCheckedChange={(v) => set({ recordInLedger: v === true })} />
              <span>
                <span className="font-medium">Also record the payment in the Ledger</span>
                <span className="block text-xs text-muted-foreground">As an expense, kept in step if you edit, cancel or void the cheque.</span>
              </span>
            </label>
          )}

          <div className="space-y-2">
            <Label>Stub</Label>
            {cheque?.stubFileName && !stub && (
              <a href={`/api/records/cheques/${cheque.id}/stub`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:underline">
                <FileText className="h-4 w-4 text-muted-foreground" />
                {cheque.stubFileName}
              </a>
            )}
            {stub && (
              <p className="flex items-center gap-2 text-sm">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                {stub.name}
              </p>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={RECORD_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                setStub(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInput.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" />
              {cheque?.stubFileName || stub ? "Replace photo" : "Attach a photo"}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {cheque ? (
            confirmDelete ? (
              <Button type="button" variant="destructive" onClick={remove} disabled={busy}>
                Delete{cheque.ledgerEntryId ? " with its ledger payment" : ""}
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
            <Button type="button" onClick={save} disabled={busy || !form.payee.trim() || !form.chequeNumber.trim() || !(Number(form.amount) > 0)}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ChequeRegister({
  churchId,
  cheques,
  accounts,
  currency,
  rates,
  canSeeLedger,
}: {
  churchId: string;
  cheques: Cheque[];
  accounts: readonly Account[];
  currency: CurrencyCode;
  rates: Record<string, number>;
  canSeeLedger: boolean;
}) {
  const [account, setAccount] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Cheque | "new" | null>(null);

  const numbersByAccount = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of cheques) map.set(c.account, [...(map.get(c.account) ?? []), c.chequeNumber]);
    return map;
  }, [cheques]);
  const label = (key: string) => accounts.find((a) => a.key === key)?.label ?? key;
  const money = (usd: number) => formatMoney(usd, currency, rates);

  const shown = cheques.filter((c) => {
    if (account !== "all" && c.account !== account) return false;
    const q = query.trim().toLowerCase();
    return !q || [c.chequeNumber, c.payee, c.purpose].filter(Boolean).some((v) => v!.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      {accounts.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((a) => {
            const numbers = numbersByAccount.get(a.key) ?? [];
            const outstanding = cheques.filter((c) => c.account === a.key && c.status === "issued");
            const gaps = chequeGaps(numbers);
            return (
              <div key={a.key} className="space-y-1 rounded-xl border p-3">
                <p className="text-sm font-medium">{a.label}</p>
                <p className="text-xs text-muted-foreground">
                  {numbers.length} cheques · next no. {nextChequeNumber(numbers) || "—"} · {outstanding.length} not yet cleared (
                  {money(outstanding.reduce((s, c) => s + c.amount, 0))})
                </p>
                {gaps.missing.length > 0 && (
                  <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    No stub recorded for {gaps.missing.join(", ")}
                    {gaps.more > 0 && ` and ${gaps.more} more`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search number, payee…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        {accounts.length > 1 && (
          <Select value={account} onValueChange={setAccount}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Both accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.key} value={a.key}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button className="gap-1.5 sm:ml-auto" onClick={() => setOpen("new")}>
          <Plus className="h-4 w-4" />
          Record a cheque
        </Button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          {cheques.length === 0 ? "No cheques recorded yet." : "Nothing matches."}
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {shown.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setOpen(c)} className="grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 text-left hover:bg-muted/40">
                <span className="pt-0.5 font-mono text-sm tabular-nums">{c.chequeNumber}</span>
                <span className="min-w-0 space-y-0.5">
                  <span className="block truncate font-medium">{c.payee}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[formatDate(c.issueDate), accounts.length > 1 ? label(c.account) : null, c.purpose].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className={cn("text-sm font-semibold tabular-nums", (c.status === "cancelled" || c.status === "void") && "text-muted-foreground line-through")}>
                    {money(c.amount)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    {c.ledgerEntryId && <BookOpenText className="h-3.5 w-3.5 text-muted-foreground" aria-label="In the ledger" />}
                    {c.stubFileName && <Paperclip className="h-3.5 w-3.5 text-muted-foreground" aria-label="Stub attached" />}
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_STYLE[c.status])}>{STATUS_LABEL[c.status]}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {canSeeLedger && cheques.some((c) => c.ledgerEntryId) && (
        <p className="text-xs text-muted-foreground">
          Cheques marked with <BookOpenText className="inline h-3 w-3" /> are also in the{" "}
          <Link href="/ledger" className="underline">
            Ledger
          </Link>{" "}
          as &ldquo;Cheque payment&rdquo; expenses.
        </p>
      )}

      {open && (
        <ChequeDialog
          key={open === "new" ? "new" : open.id}
          churchId={churchId}
          cheque={open === "new" ? undefined : open}
          accounts={accounts}
          numbersByAccount={numbersByAccount}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

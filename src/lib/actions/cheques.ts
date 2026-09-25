"use server";

import { revalidatePath } from "next/cache";
import { authorise } from "@/lib/records/authorise";
import { RECORDS_BUCKET, checkRecordFile } from "@/lib/records/files";
import { pathIsUnder, removeFiles } from "@/lib/storage/private-files";
import type { ChequeStatus } from "@/lib/supabase/types";
import { tenant } from "@/tenant";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";
import type { UploadedFile } from "./records";

export type ChequeInput = {
  id?: string;
  churchId: string;
  account: string;
  chequeNumber: string;
  issueDate: string;
  payee: string;
  amount: number;
  purpose?: string;
  status: ChequeStatus;
  // New cheques only: also book the payment in the ledger, linked to it.
  recordInLedger?: boolean;
  stub?: UploadedFile | null;
};

const STATUSES: ChequeStatus[] = ["issued", "cleared", "cancelled", "void"];
// A cancelled or void cheque never paid anyone.
const PAID = (s: ChequeStatus) => s === "issued" || s === "cleared";
const LEDGER_CATEGORY = "Cheque payment";

function ledgerDescription(input: ChequeInput) {
  return `Cheque ${input.chequeNumber.trim()} · ${input.payee.trim()}${input.purpose?.trim() ? ` — ${input.purpose.trim()}` : ""}`;
}

function validate(input: ChequeInput): string | null {
  if (!tenant.records.bankAccounts.some((a) => a.key === input.account)) return "Pick the account the cheque was drawn on.";
  if (!input.chequeNumber.trim()) return "Enter the cheque number.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.issueDate)) return "Pick the date on the cheque.";
  if (!input.payee.trim()) return "Who is the cheque payable to?";
  if (!(input.amount > 0)) return "Enter the amount.";
  if (!STATUSES.includes(input.status)) return "Pick a status.";
  if (input.stub) {
    const problem = checkRecordFile(input.stub.type, input.stub.size);
    if (problem) return problem;
  }
  return null;
}

export async function saveCheque(input: ChequeInput): Promise<ActionResult> {
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };
  const auth = await authorise(input.churchId, "cheque");
  if (!auth.ok) return auth;
  const { profile, supabase, folder } = auth;
  if (input.stub && !pathIsUnder(input.stub.path, folder)) return { ok: false, error: "That upload doesn't belong to this chapter." };

  const fields = {
    account: input.account,
    cheque_number: input.chequeNumber.trim(),
    issue_date: input.issueDate,
    payee: input.payee.trim(),
    amount: input.amount,
    purpose: input.purpose?.trim() || null,
    status: input.status,
    ...(input.stub ? { stub_path: input.stub.path, stub_file_name: input.stub.name.slice(0, 200) } : {}),
  };
  const duplicate = (message: string) =>
    /duplicate key|unique/i.test(message) ? `Cheque ${fields.cheque_number} is already recorded for that account.` : message;

  if (!input.id) {
    let ledgerEntryId: string | null = null;
    if (input.recordInLedger && PAID(input.status)) {
      const { data: entry, error } = await supabase
        .from("ledger_entries")
        .insert({
          zone_id: profile.zoneId,
          church_id: input.churchId,
          type: "expense",
          category: LEDGER_CATEGORY,
          description: ledgerDescription(input),
          amount: input.amount,
          entry_date: input.issueDate,
          created_by: profile.userId,
        })
        .select("id")
        .single();
      if (error || !entry) return { ok: false, error: error?.message ?? "Could not record the ledger payment." };
      ledgerEntryId = entry.id;
    }
    const { error } = await supabase.from("cheques").insert({
      zone_id: profile.zoneId,
      church_id: input.churchId,
      created_by: profile.userId,
      ledger_entry_id: ledgerEntryId,
      ...fields,
    });
    if (error) {
      // Don't leave a ledger payment behind for a cheque that wasn't saved.
      if (ledgerEntryId) await supabase.from("ledger_entries").delete().eq("id", ledgerEntryId);
      return { ok: false, error: duplicate(error.message) };
    }
    await logAudit(profile, "cheque.create", `Recorded cheque ${fields.cheque_number} to ${fields.payee}${ledgerEntryId ? " (and the ledger payment)" : ""}`);
  } else {
    const { data: existing } = await supabase
      .from("cheques")
      .select("ledger_entry_id, stub_path, church_id")
      .eq("id", input.id)
      .maybeSingle();
    if (!existing || existing.church_id !== input.churchId) return { ok: false, error: "That cheque no longer exists." };

    const { error } = await supabase.from("cheques").update(fields).eq("id", input.id);
    if (error) return { ok: false, error: duplicate(error.message) };
    if (input.stub && existing.stub_path && existing.stub_path !== input.stub.path) {
      await removeFiles(RECORDS_BUCKET, [existing.stub_path]);
    }

    // Keep the linked ledger payment in step: it follows the cheque's details,
    // and goes away when the cheque is cancelled or voided.
    let ledgerNote = "";
    if (existing.ledger_entry_id) {
      if (PAID(input.status)) {
        await supabase
          .from("ledger_entries")
          .update({ amount: input.amount, entry_date: input.issueDate, description: ledgerDescription(input) })
          .eq("id", existing.ledger_entry_id);
      } else {
        await supabase.from("ledger_entries").delete().eq("id", existing.ledger_entry_id);
        ledgerNote = " and removed its ledger payment";
      }
    }
    await logAudit(profile, "cheque.update", `Updated cheque ${fields.cheque_number} (${input.status})${ledgerNote}`);
  }

  revalidatePath("/records");
  revalidatePath("/ledger");
  return { ok: true };
}

// For mistakes only — a cancelled or void cheque should be kept, marked as
// such. Removes the linked ledger payment too.
export async function deleteCheque(chequeId: string, churchId: string): Promise<ActionResult> {
  const auth = await authorise(churchId, "cheque");
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;

  const { data: cheque } = await supabase
    .from("cheques")
    .select("cheque_number, ledger_entry_id, stub_path")
    .eq("id", chequeId)
    .eq("church_id", churchId)
    .maybeSingle();
  if (!cheque) return { ok: false, error: "That cheque no longer exists." };

  const { error } = await supabase.from("cheques").delete().eq("id", chequeId);
  if (error) return { ok: false, error: error.message };
  if (cheque.ledger_entry_id) await supabase.from("ledger_entries").delete().eq("id", cheque.ledger_entry_id);
  if (cheque.stub_path) await removeFiles(RECORDS_BUCKET, [cheque.stub_path]);

  await logAudit(profile, "cheque.delete", `Deleted cheque ${cheque.cheque_number}`);
  revalidatePath("/records");
  revalidatePath("/ledger");
  return { ok: true };
}

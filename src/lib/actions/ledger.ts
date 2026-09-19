"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { LedgerEntryType } from "@/lib/data/types";
import type { ActionResult } from "./members";

type CreateLedgerEntryInput = {
  churchId: string;
  type: LedgerEntryType;
  category: string;
  description?: string;
  amount: number;
  entryDate: string;
};

export async function createLedgerEntry(input: CreateLedgerEntryInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role === "member") return { ok: false, error: "Not permitted." };
  if (!input.category.trim() || !(input.amount > 0)) {
    return { ok: false, error: "Category and a positive amount are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("ledger_entries").insert({
    zone_id: profile.zoneId,
    church_id: input.churchId,
    type: input.type,
    category: input.category.trim(),
    description: input.description?.trim() || null,
    amount: input.amount,
    entry_date: input.entryDate,
    created_by: profile.userId,
  });

  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "ledger_entry.create", `Recorded ${input.type} of ${input.amount} (${input.category})`);
  revalidatePath("/ledger");
  return { ok: true };
}

export type BulkLedgerImportResult = { ok: true; inserted: number } | { ok: false; error: string };

export async function bulkImportLedgerEntries(
  rows: CreateLedgerEntryInput[]
): Promise<BulkLedgerImportResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role === "member") return { ok: false, error: "Not permitted." };
  if (rows.length === 0) return { ok: true, inserted: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .insert(
      rows.map((r) => ({
        zone_id: profile.zoneId,
        church_id: r.churchId,
        type: r.type,
        category: r.category.trim(),
        description: r.description?.trim() || null,
        amount: r.amount,
        entry_date: r.entryDate,
        created_by: profile.userId,
      }))
    )
    .select("id");

  if (error || !data) return { ok: false, error: error?.message ?? "Import failed." };

  await logAudit(profile, "ledger_entry.bulk_import", `Imported ${data.length} ledger entries`);
  revalidatePath("/ledger");
  return { ok: true, inserted: data.length };
}

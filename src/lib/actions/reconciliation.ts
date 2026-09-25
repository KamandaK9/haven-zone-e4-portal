"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";

type CreateReconciliationInput = {
  churchId: string;
  periodEnd: string; // YYYY-MM-DD
  actualBalance: number;
  notes?: string;
};

export type ReconciliationResult =
  | { ok: true; calculatedBalance: number; variance: number }
  | { ok: false; error: string };

export async function createReconciliation(input: CreateReconciliationInput): Promise<ReconciliationResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_ledger")) return { ok: false, error: "Not permitted." };
  if (!Number.isFinite(input.actualBalance)) return { ok: false, error: "Enter a valid balance." };

  const supabase = await createClient();

  // Never trust a client-sent "calculated balance" — always derive it
  // server-side from every ledger entry up to the chosen date.
  const { data: entries, error: entriesError } = await supabase
    .from("ledger_entries")
    .select("type, amount")
    .eq("zone_id", profile.zoneId)
    .eq("church_id", input.churchId)
    .lte("entry_date", input.periodEnd);
  if (entriesError) return { ok: false, error: entriesError.message };

  const calculatedBalance = (entries ?? []).reduce(
    (sum, e) => sum + (e.type === "income" ? Number(e.amount) : -Number(e.amount)),
    0
  );
  const variance = Math.round((input.actualBalance - calculatedBalance) * 100) / 100;

  const { error } = await supabase.from("reconciliations").insert({
    zone_id: profile.zoneId,
    church_id: input.churchId,
    period_end: input.periodEnd,
    actual_balance: input.actualBalance,
    calculated_balance: calculatedBalance,
    variance,
    notes: input.notes?.trim() || null,
    reconciled_by: profile.userId,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit(
    profile,
    "reconciliation.create",
    `Reconciled a church's books as of ${input.periodEnd} — ${variance === 0 ? "balanced" : `variance ${variance}`}`
  );
  revalidatePath("/ledger");
  return { ok: true, calculatedBalance, variance };
}

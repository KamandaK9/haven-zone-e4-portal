"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { isGivingCategory, type GivingCategory } from "@/lib/giving";
import { logAudit } from "./audit";

type GivingImportRow = { memberId: string; month: string; category: GivingCategory; amount: number };

export type BulkGivingImportResult = { ok: true; imported: number; members: number } | { ok: false; error: string };

// Re-importing the same period replaces a member's amount for that
// month/category rather than adding to it, so a corrected spreadsheet can
// simply be uploaded again.
export async function bulkImportGiving(rows: GivingImportRow[]): Promise<BulkGivingImportResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "import_giving")) return { ok: false, error: "Not permitted." };
  if (rows.length === 0) return { ok: true, imported: 0, members: 0 };

  const supabase = await createClient();

  // Only accept members that belong to the caller's zone.
  const zoneMemberIds = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("members")
      .select("id")
      .eq("zone_id", profile.zoneId)
      .range(from, from + pageSize - 1);
    if (error) return { ok: false, error: error.message };
    for (const m of data ?? []) zoneMemberIds.add(m.id);
    if (!data || data.length < pageSize) break;
  }

  // An upsert can't touch the same row twice in one statement, so fold
  // duplicate member/month/category lines together first.
  const merged = new Map<string, GivingImportRow>();
  for (const r of rows) {
    if (!zoneMemberIds.has(r.memberId) || !isGivingCategory(r.category) || !(r.amount > 0)) continue;
    const key = `${r.memberId}|${r.month}|${r.category}`;
    const existing = merged.get(key);
    merged.set(key, existing ? { ...existing, amount: existing.amount + r.amount } : r);
  }
  const toWrite = [...merged.values()];
  if (toWrite.length === 0) return { ok: false, error: "None of those rows matched a member in this zone." };

  const batchSize = 500;
  for (let i = 0; i < toWrite.length; i += batchSize) {
    const { error } = await supabase.from("giving_entries").upsert(
      toWrite.slice(i, i + batchSize).map((r) => ({
        member_id: r.memberId,
        zone_id: profile.zoneId,
        month: r.month,
        category: r.category,
        amount: r.amount,
      })),
      { onConflict: "member_id,month,category" }
    );
    if (error) return { ok: false, error: error.message };
  }

  const memberCount = new Set(toWrite.map((r) => r.memberId)).size;
  await logAudit(profile, "giving.bulk_import", `Imported ${toWrite.length} giving entries for ${memberCount} members`);
  for (const path of ["/dashboard", "/reports", "/ledger", "/countries", "/members"]) revalidatePath(path);
  return { ok: true, imported: toWrite.length, members: memberCount };
}

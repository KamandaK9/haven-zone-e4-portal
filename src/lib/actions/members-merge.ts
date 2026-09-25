"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";
import type { LessonStatus } from "@/lib/data/types";

const STATUS_RANK: Record<LessonStatus, number> = { not_started: 0, in_progress: 1, completed: 2 };

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  profile_id: string | null;
  title: string | null;
  kc_handle: string | null;
  profession: string | null;
  spouse_name: string | null;
  birthday: string | null;
  wedding_anniversary: string | null;
  join_date: string | null;
};

// Combines two member rows the staff member has identified as the same
// person: `keepId` survives, `mergeId` is folded into it and deleted.
// Giving and training history move onto the survivor rather than being
// lost, and a login on the losing row is transferred if the surviving row
// doesn't already have one. If both rows have separate logins, this refuses
// — that needs a person to decide which login stays, not an automatic merge.
export async function mergeDuplicateMembers(keepId: string, mergeId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_members")) return { ok: false, error: "Not permitted." };
  if (keepId === mergeId) return { ok: false, error: "Pick two different people." };

  // The regular RLS-scoped client is what actually enforces "only within
  // your own scope" here — if either row isn't visible to this caller (out
  // of their chapter/sub-zone), the select simply won't return it.
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("members")
    .select(
      "id, first_name, last_name, email, phone, profile_id, title, kc_handle, profession, spouse_name, birthday, wedding_anniversary, join_date, zone_id"
    )
    .in("id", [keepId, mergeId]);

  const keep = rows?.find((r) => r.id === keepId) as (MemberRow & { zone_id: string }) | undefined;
  const merge = rows?.find((r) => r.id === mergeId) as (MemberRow & { zone_id: string }) | undefined;
  if (!keep || !merge) return { ok: false, error: "One of those members wasn't found, or isn't in your scope." };
  if (keep.zone_id !== profile.zoneId || merge.zone_id !== profile.zoneId) return { ok: false, error: "Not permitted." };

  if (keep.profile_id && merge.profile_id && keep.profile_id !== merge.profile_id) {
    return {
      ok: false,
      error:
        "Both records have their own portal login — decide which one should keep access (Team & access), then merge again.",
    };
  }

  const admin = createAdminClient();
  const keepName = `${keep.first_name} ${keep.last_name}`;
  const mergeName = `${merge.first_name} ${merge.last_name}`;

  // 1. Fill in anything the surviving row is missing from the one being merged.
  const filledFields: {
    email?: string;
    phone?: string;
    title?: string;
    kc_handle?: string;
    profession?: string;
    spouse_name?: string;
    birthday?: string;
    wedding_anniversary?: string;
    join_date?: string;
    profile_id?: string;
  } = {};
  const fillable: [keyof typeof filledFields, string | null][] = [
    ["email", keep.email ?? merge.email],
    ["phone", keep.phone ?? merge.phone],
    ["title", keep.title ?? merge.title],
    ["kc_handle", keep.kc_handle ?? merge.kc_handle],
    ["profession", keep.profession ?? merge.profession],
    ["spouse_name", keep.spouse_name ?? merge.spouse_name],
    ["birthday", keep.birthday ?? merge.birthday],
    ["wedding_anniversary", keep.wedding_anniversary ?? merge.wedding_anniversary],
    ["join_date", keep.join_date ?? merge.join_date],
  ];
  for (const [field, value] of fillable) {
    if (value != null) filledFields[field] = value;
  }

  // 2. Transfer a login from the losing row, if the surviving row has none.
  // The unique index on members.profile_id means both rows can never hold
  // the same login at once, so it has to be released from `merge` first.
  let transferredLogin = false;
  if (!keep.profile_id && merge.profile_id) {
    const loginId = merge.profile_id;
    const { error: releaseError } = await admin.from("members").update({ profile_id: null }).eq("id", mergeId);
    if (releaseError) return { ok: false, error: releaseError.message };
    filledFields.profile_id = loginId;
    transferredLogin = true;
  }

  if (Object.keys(filledFields).length > 0) {
    const { error } = await admin.from("members").update(filledFields).eq("id", keepId);
    if (error) return { ok: false, error: error.message };
  }

  // 3. Giving: fold amounts together where keep already has that month +
  // category, otherwise re-point the entry onto the surviving row.
  const [{ data: keepGiving }, { data: mergeGiving }] = await Promise.all([
    admin.from("giving_entries").select("id, month, category, amount").eq("member_id", keepId),
    admin.from("giving_entries").select("id, month, category, amount").eq("member_id", mergeId),
  ]);
  const givingByKey = new Map((keepGiving ?? []).map((g) => [`${g.month}|${g.category ?? ""}`, g]));
  for (const g of mergeGiving ?? []) {
    const key = `${g.month}|${g.category ?? ""}`;
    const existing = givingByKey.get(key);
    if (existing) {
      await admin
        .from("giving_entries")
        .update({ amount: Number(existing.amount) + Number(g.amount) })
        .eq("id", existing.id);
      await admin.from("giving_entries").delete().eq("id", g.id);
    } else {
      await admin.from("giving_entries").update({ member_id: keepId }).eq("id", g.id);
    }
  }

  // 4. Training: keep whichever status is furthest along for a program both
  // rows have; re-point anything the surviving row doesn't have yet.
  const [{ data: keepTrainings }, { data: mergeTrainings }] = await Promise.all([
    admin.from("trainings").select("id, program_id, status, completed_at").eq("member_id", keepId),
    admin.from("trainings").select("id, program_id, status, completed_at").eq("member_id", mergeId),
  ]);
  const trainingByProgram = new Map((keepTrainings ?? []).filter((t) => t.program_id).map((t) => [t.program_id as string, t]));
  for (const t of mergeTrainings ?? []) {
    if (!t.program_id) continue; // legacy free-text training — cleaned up with the row below
    const existing = trainingByProgram.get(t.program_id);
    if (existing) {
      if (STATUS_RANK[t.status as LessonStatus] > STATUS_RANK[existing.status as LessonStatus]) {
        await admin.from("trainings").update({ status: t.status, completed_at: t.completed_at }).eq("id", existing.id);
      }
      await admin.from("trainings").delete().eq("id", t.id);
    } else {
      // Best-effort: the rare legacy row sharing the old (member_id, name)
      // constraint could conflict — leave it behind rather than fail the merge.
      await admin.from("trainings").update({ member_id: keepId }).eq("id", t.id);
    }
  }

  // 5. The losing row's own history is now empty (moved or folded above), so
  // deleting it cascades cleanly.
  const { error: deleteError } = await admin.from("members").delete().eq("id", mergeId);
  if (deleteError) return { ok: false, error: deleteError.message };

  await logAudit(
    profile,
    "member.merge",
    `Merged "${mergeName}" into "${keepName}"${transferredLogin ? " (portal login moved to the surviving record)" : ""}`
  );
  revalidatePath("/", "layout");
  return { ok: true };
}

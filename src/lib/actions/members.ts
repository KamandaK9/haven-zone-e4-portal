"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { MemberRole } from "@/lib/data/types";

const DEFAULT_TRAININGS = [
  { name: "New Believers Class", icon: "Heart", points: 10 },
  { name: "Foundation School", icon: "BookOpen", points: 20 },
  { name: "Leadership Development", icon: "GraduationCap", points: 30 },
  { name: "Water Baptism", icon: "Droplet", points: 15 },
];

const AVATAR_COLORS = ["#7c3aed", "#a21caf", "#9333ea", "#be185d", "#6d28d9", "#c026d3", "#8b5cf6"];

// Every new zone effectively "seeds" these 4 programs the first time a
// member is created/imported — after that, staff can rename, extend, or
// add entirely new programs from the Training page, same as this does.
async function getOrCreateDefaultPrograms(
  supabase: Awaited<ReturnType<typeof createClient>>,
  zoneId: string
): Promise<string[]> {
  const names = DEFAULT_TRAININGS.map((t) => t.name);
  const { data: existing } = await supabase.from("training_programs").select("id, name").eq("zone_id", zoneId).in("name", names);

  const byName = new Map((existing ?? []).map((p) => [p.name, p.id]));
  const missing = DEFAULT_TRAININGS.filter((t) => !byName.has(t.name));
  if (missing.length > 0) {
    const { data: created } = await supabase
      .from("training_programs")
      .insert(missing.map((t) => ({ zone_id: zoneId, name: t.name, icon: t.icon, points: t.points })))
      .select("id, name");
    for (const p of created ?? []) byName.set(p.name, p.id);
  }

  return names.map((n) => byName.get(n)).filter((id): id is string => !!id);
}

type CreateMemberInput = {
  churchId: string;
  countryId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: MemberRole;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createMember(input: CreateMemberInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!input.firstName.trim() || !input.lastName.trim()) {
    return { ok: false, error: "First and last name are required." };
  }

  const supabase = await createClient();

  const { data: member, error } = await supabase
    .from("members")
    .insert({
      zone_id: profile.zoneId,
      church_id: input.churchId,
      country_id: input.countryId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      role: input.role,
      avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    })
    .select("id")
    .single();

  if (error || !member) {
    return { ok: false, error: error?.message ?? "Could not add member." };
  }

  const programIds = await getOrCreateDefaultPrograms(supabase, profile.zoneId);
  await supabase.from("trainings").insert(
    programIds.map((program_id) => ({
      member_id: member.id,
      zone_id: profile.zoneId,
      program_id,
      assigned_by: profile.userId,
      status: "not_started" as const,
    }))
  );

  const { data: church } = await supabase.from("churches").select("name").eq("id", input.churchId).single();
  await supabase.from("activity").insert({
    zone_id: profile.zoneId,
    type: "new_member",
    message: `New member added at ${church?.name ?? "a church"}`,
    church_id: input.churchId,
  });

  await logAudit(profile, "member.create", `Added ${input.firstName.trim()} ${input.lastName.trim()} at ${church?.name ?? "a church"}`);
  revalidatePath("/", "layout");
  return { ok: true };
}

export type ParsedMemberRow = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  joinDate?: string;
  role?: MemberRole;
  // Real exports often carry a running total rather than a month-by-month
  // history — one giving_entries row gets created for it (dated to
  // givingDate's month, or the current month if absent) rather than a
  // fabricated monthly breakdown.
  givingTotal?: number;
  givingDate?: string;
  // Leadership-roster-only fields (parse-leadership-roster.ts) — verbatim
  // free text from source spreadsheets with wildly inconsistent formatting,
  // stored as-is rather than parsed into structured dates/enums.
  title?: string;
  kcHandle?: string;
  profession?: string;
  spouseName?: string;
  birthday?: string;
  weddingAnniversary?: string;
  elevateToAdmin?: boolean;
};

export type BulkImportResult = {
  ok: true;
  inserted: number;
  errors: { row: number; reason: string }[];
} | { ok: false; error: string };

export async function bulkImportMembers(input: {
  churchId: string;
  countryId: string;
  rows: ParsedMemberRow[];
}): Promise<BulkImportResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const errors: { row: number; reason: string }[] = [];
  const toInsert: {
    zone_id: string;
    church_id: string;
    country_id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    join_date?: string;
    role: MemberRole;
    avatar_color: string;
  }[] = [];
  const givingByIndex: (number | undefined)[] = [];
  const givingMonthByIndex: (string | undefined)[] = [];

  input.rows.forEach((row, i) => {
    if (!row.firstName?.trim() && !row.lastName?.trim()) {
      errors.push({ row: i + 1, reason: "Missing first and last name" });
      return;
    }
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, reason: "Missing first or last name" });
      return;
    }
    toInsert.push({
      zone_id: profile.zoneId,
      church_id: input.churchId,
      country_id: input.countryId,
      first_name: row.firstName.trim(),
      last_name: row.lastName.trim(),
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      join_date: row.joinDate,
      role: row.role ?? "Member",
      avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    });
    givingByIndex.push(row.givingTotal && row.givingTotal > 0 ? row.givingTotal : undefined);
    givingMonthByIndex.push((row.givingDate ?? new Date().toISOString().slice(0, 10)).slice(0, 7));
  });

  if (toInsert.length === 0) {
    return { ok: true, inserted: 0, errors };
  }

  const { data: inserted, error } = await supabase.from("members").insert(toInsert).select("id");
  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Import failed." };
  }

  const programIds = await getOrCreateDefaultPrograms(supabase, profile.zoneId);
  const trainingRows = inserted.flatMap((m) =>
    programIds.map((program_id) => ({
      member_id: m.id,
      zone_id: profile.zoneId,
      program_id,
      assigned_by: profile.userId,
      status: "not_started" as const,
    }))
  );
  if (trainingRows.length > 0) {
    await supabase.from("trainings").insert(trainingRows);
  }

  const givingRows = inserted
    .map((m, i) => ({ member_id: m.id, zone_id: profile.zoneId, month: givingMonthByIndex[i]!, amount: givingByIndex[i] }))
    .filter((g): g is { member_id: string; zone_id: string; month: string; amount: number } => g.amount !== undefined);
  if (givingRows.length > 0) {
    await supabase.from("giving_entries").insert(givingRows);
  }

  const { data: church } = await supabase.from("churches").select("name").eq("id", input.churchId).single();
  await supabase.from("activity").insert({
    zone_id: profile.zoneId,
    type: "new_member",
    message: `${inserted.length} members imported at ${church?.name ?? "a church"}`,
    church_id: input.churchId,
  });

  await logAudit(profile, "member.bulk_import", `Imported ${inserted.length} members at ${church?.name ?? "a church"}`);
  revalidatePath("/", "layout");
  return { ok: true, inserted: inserted.length, errors };
}

function randomTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export type InviteMemberResult = { ok: true; tempPassword: string } | { ok: false; error: string };

// Gives an existing member row a real login (role 'member') to the
// self-service portal. Staff-only; the member never invites themselves.
export async function inviteMemberToPortal(memberId: string): Promise<InviteMemberResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role === "member") return { ok: false, error: "Not permitted." };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("id, email, first_name, last_name, profile_id, zone_id")
    .eq("id", memberId)
    .single();

  if (!member) return { ok: false, error: "Member not found." };
  if (member.zone_id !== profile.zoneId) return { ok: false, error: "Not permitted." };
  if (member.profile_id) return { ok: false, error: "This member already has portal access." };
  if (!member.email) return { ok: false, error: "Add an email for this member first." };

  const admin = createAdminClient();
  const tempPassword = randomTempPassword();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: member.email,
    password: tempPassword,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    return { ok: false, error: authError?.message ?? "Could not create a login for this member." };
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    zone_id: profile.zoneId,
    role: "member",
    full_name: `${member.first_name} ${member.last_name}`,
    email: member.email,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { ok: false, error: profileError.message };
  }

  const { error: linkError } = await admin.from("members").update({ profile_id: authUser.user.id }).eq("id", memberId);
  if (linkError) {
    return { ok: false, error: linkError.message };
  }

  await logAudit(profile, "member.invite_to_portal", `Invited ${member.first_name} ${member.last_name} to the member portal`);
  revalidatePath("/", "layout");
  return { ok: true, tempPassword };
}

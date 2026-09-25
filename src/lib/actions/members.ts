"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomAvatarColor } from "@/lib/avatar-color";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import {
  canActOn,
  isPortfolio,
  isPosition,
  loginFor,
  type Portfolio,
  type Position,
} from "@/lib/access";
import { getAutoAssignedProgramIds } from "@/lib/data/programs-server";
import { getSiteUrl } from "@/lib/site-url";
import { logAudit } from "./audit";
import type { MemberRole } from "@/lib/data/types";

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
  if (!can(profile, "manage_members")) return { ok: false, error: "Not permitted." };
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
      // Someone added by hand joined now; roster imports leave this blank.
      join_date: new Date().toISOString().slice(0, 10),
      avatar_color: randomAvatarColor(),
    })
    .select("id")
    .single();

  if (error || !member) {
    return { ok: false, error: error?.message ?? "Could not add member." };
  }

  const programIds = await getAutoAssignedProgramIds(profile.zoneId);
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
  // Leadership position parsed from the roster DESIGNATION column. Recorded
  // only — a login is issued later, by invite, never in bulk.
  position?: Position;
  portfolio?: Portfolio;
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
  if (!can(profile, "manage_members")) return { ok: false, error: "Not permitted." };

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

  // Anyone already in this chapter (same email, or the same name) is skipped
  // rather than added a second time — re-importing a file is safe.
  const nameKey = (first: string, last: string) =>
    `${first} ${last}`.toLowerCase().split(/[^a-z]+/).filter(Boolean).sort().join(" ");
  const { data: existingMembers } = await supabase
    .from("members")
    .select("first_name, last_name, email")
    .eq("church_id", input.churchId);
  const seenEmails = new Set((existingMembers ?? []).map((m) => m.email?.trim().toLowerCase()).filter(Boolean));
  const seenNames = new Set((existingMembers ?? []).map((m) => nameKey(m.first_name, m.last_name)));

  input.rows.forEach((row, i) => {
    if (!row.firstName?.trim() && !row.lastName?.trim()) {
      errors.push({ row: i + 1, reason: "Missing first and last name" });
      return;
    }
    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      errors.push({ row: i + 1, reason: "Missing first or last name" });
      return;
    }
    const email = row.email?.trim().toLowerCase();
    const key = nameKey(row.firstName, row.lastName);
    if ((email && seenEmails.has(email)) || seenNames.has(key)) {
      errors.push({ row: i + 1, reason: `${row.firstName.trim()} ${row.lastName.trim()} is already in this chapter` });
      return;
    }
    if (email) seenEmails.add(email);
    seenNames.add(key);

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
      avatar_color: randomAvatarColor(),
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

  const programIds = await getAutoAssignedProgramIds(profile.zoneId);
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

export type InviteMemberResult =
  | { ok: true; emailed: true }
  | { ok: true; emailed: false; tempPassword: string }
  | { ok: false; error: string };

// Gives an existing member row a real login. The login carries the person's
// position, so a Governor invited here can only ever see their own chapter.
// You can only invite people below your own position, and only within the
// scope RLS already lets you see.
//
// Sends a real invite email (they set their own password via the link) —
// falling back to the old show-it-once temp password only if the email
// can't be sent, e.g. no SMTP provider configured yet in Supabase.
export async function inviteMemberToPortal(memberId: string): Promise<InviteMemberResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_members")) return { ok: false, error: "Not permitted." };

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("id, email, first_name, last_name, profile_id, zone_id, church_id, position, portfolio")
    .eq("id", memberId)
    .single();

  if (!member) return { ok: false, error: "Member not found." };
  if (member.zone_id !== profile.zoneId) return { ok: false, error: "Not permitted." };
  if (member.profile_id) return { ok: false, error: "This member already has portal access." };
  if (!member.email) return { ok: false, error: "Add an email for this member first." };

  const position = isPosition(member.position) ? member.position : "member";
  const portfolio = isPortfolio(member.portfolio) ? member.portfolio : null;
  if (position !== "member" && !canActOn(profile.position, position)) {
    return { ok: false, error: "You can only give portal access to people below your own position." };
  }

  const { data: church } = await supabase.from("churches").select("sub_zone_id").eq("id", member.church_id).single();
  const login = loginFor(position, portfolio);
  const admin = createAdminClient();
  const fullName = `${member.first_name} ${member.last_name}`;

  // Attaches the zone profile to an auth user just created for this member,
  // and links the member row to it — shared by both the "emailed" and
  // "temp password" paths below.
  async function finishInvite(userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      zone_id: profile!.zoneId,
      role: login.role,
      full_name: fullName,
      email: member!.email!,
      position,
      portfolio,
      scope: login.scope,
      sub_zone_id: church?.sub_zone_id ?? null,
      church_id: member!.church_id,
      caps: login.caps,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: profileError.message };
    }

    const { error: linkError } = await admin.from("members").update({ profile_id: userId }).eq("id", memberId);
    if (linkError) return { ok: false, error: linkError.message };
    return { ok: true };
  }

  const siteUrl = await getSiteUrl();
  const invited = await admin.auth.admin.inviteUserByEmail(member.email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });

  if (invited.data.user) {
    const result = await finishInvite(invited.data.user.id);
    if (!result.ok) return result;
    await logAudit(profile, "member.invite_to_portal", `Invited ${fullName} to the portal as ${position.replace(/_/g, " ")}`);
    revalidatePath("/", "layout");
    return { ok: true, emailed: true };
  }

  // Most likely no SMTP provider is configured yet — fall back to a
  // one-time password shown on screen so the leader isn't blocked.
  const tempPassword = randomTempPassword();
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: member.email,
    password: tempPassword,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    return { ok: false, error: authError?.message ?? invited.error?.message ?? "Could not create a login for this member." };
  }

  const result = await finishInvite(authUser.user.id);
  if (!result.ok) return result;

  await logAudit(
    profile,
    "member.invite_to_portal",
    `Gave ${fullName} portal access as ${position.replace(/_/g, " ")} (email not sent — shown as a one-time password)`
  );
  revalidatePath("/", "layout");
  return { ok: true, emailed: false, tempPassword };
}

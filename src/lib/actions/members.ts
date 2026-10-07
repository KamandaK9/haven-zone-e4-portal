"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomAvatarColor } from "@/lib/avatar-color";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import {
  canActOn,
  isLeader,
  isPortfolio,
  isPosition,
  loginFor,
  type Portfolio,
  type Position,
} from "@/lib/access";
import { tenant } from "@/tenant";
import { getAutoAssignedProgramIds } from "@/lib/data/programs-server";
import { getSiteUrl } from "@/lib/site-url";
import { matchCell } from "@/lib/import/match-cell";
import { logAudit } from "./audit";
import type { MemberRole } from "@/lib/data/types";
import { randomInt } from "node:crypto";
import { TOO_MANY, withinRateLimit } from "@/lib/rate-limit";
import { labels, lower } from "@/lib/labels";
import { normaliseFieldValue, type MemberField } from "@/lib/custom-fields";
import { mapMemberField } from "@/lib/data/member-fields";

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
  // The member's cell group, by name — matched to an existing cell in the
  // chapter, or created as a new top-level cell on import.
  cellName?: string;
  ageGroup?: string; // a tenant.ageGroups key
  // The organisation's own member fields, by field key, as typed in the
  // sheet — checked against each field's type when imported.
  custom?: Record<string, string>;
};

export type BulkImportResult = {
  ok: true;
  inserted: number;
  errors: { row: number; reason: string }[];
  // Cell names from the file that matched none of the chapter's cells.
  unmatchedCells?: { name: string; count: number }[];
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
    title: string | null;
    birthday: string | null;
    cell_id?: string | null;
    age_group: string | null;
    profession: string | null;
    spouse_name: string | null;
    wedding_anniversary: string | null;
    kc_handle: string | null;
  }[] = [];
  const cellNameByIndex: (string | undefined)[] = [];
  const customByIndex: (Record<string, string> | undefined)[] = [];
  const rowNumberByIndex: number[] = [];
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
    // A surname is optional (some sheets only have one name for a person);
    // a first name isn't.
    if (!row.firstName?.trim()) {
      errors.push({ row: i + 1, reason: "Missing a name" });
      return;
    }
    const lastName = row.lastName?.trim() ?? "";
    const fullName = `${row.firstName.trim()} ${lastName}`.trim();
    const email = row.email?.trim().toLowerCase();
    // Matching on a first name alone would merge different people, so a
    // surname-less row is only ever deduplicated by email.
    const key = lastName ? nameKey(row.firstName, lastName) : undefined;
    if ((email && seenEmails.has(email)) || (key && seenNames.has(key))) {
      errors.push({ row: i + 1, reason: `${fullName} is already in this ${lower(labels.location)}` });
      return;
    }
    if (email) seenEmails.add(email);
    if (key) seenNames.add(key);

    toInsert.push({
      zone_id: profile.zoneId,
      church_id: input.churchId,
      country_id: input.countryId,
      first_name: row.firstName.trim(),
      last_name: lastName,
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      join_date: row.joinDate,
      role: row.role ?? "Member",
      avatar_color: randomAvatarColor(),
      title: row.title?.trim() || null,
      birthday: row.birthday?.trim() || null,
      age_group: row.ageGroup ?? null,
      profession: row.profession?.trim() || null,
      spouse_name: row.spouseName?.trim() || null,
      wedding_anniversary: row.weddingAnniversary?.trim() || null,
      kc_handle: row.kcHandle?.trim() || null,
    });
    cellNameByIndex.push(row.cellName?.trim() || undefined);
    customByIndex.push(row.custom);
    rowNumberByIndex.push(i + 1);
    givingByIndex.push(row.givingTotal && row.givingTotal > 0 ? row.givingTotal : undefined);
    givingMonthByIndex.push((row.givingDate ?? new Date().toISOString().slice(0, 10)).slice(0, 7));
  });

  if (toInsert.length === 0) {
    return { ok: true, inserted: 0, errors };
  }

  // Cells are matched by name to the chapter's existing cells (forgiving
  // case, spacing and small typos — see matchCell). Names that don't match
  // aren't created as new cells: hand-kept sheets spell one cell many ways,
  // so the member is imported without a cell and the name is reported back.
  const unmatchedCellCounts = new Map<string, number>();
  if (cellNameByIndex.some(Boolean)) {
    const { data: cells } = await supabase.from("cells").select("id, name").eq("church_id", input.churchId);
    toInsert.forEach((m, i) => {
      const name = cellNameByIndex[i];
      if (!name) return;
      const cell = matchCell(name, cells ?? []);
      if (cell) m.cell_id = cell.id;
      else unmatchedCellCounts.set(name, (unmatchedCellCounts.get(name) ?? 0) + 1);
    });
  }
  const unmatchedCells = [...unmatchedCellCounts].map(([name, count]) => ({ name, count }));

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

  // The organisation's own fields: each value is checked against its field's
  // type, and only fields this person may write are filled (RLS would
  // refuse the rest); anything left out is reported, not fatal.
  if (customByIndex.some(Boolean)) {
    const fieldRows = (await supabase.from("member_fields").select("*").eq("zone_id", profile.zoneId).eq("archived", false)).data ?? [];
    const fields = new Map(fieldRows.map((f) => [f.key, mapMemberField(f)]));
    const writable = (f: MemberField) =>
      f.visibility === "admins" ? can(profile, "manage_settings") : f.visibility === "contact" ? can(profile, "view_contact_details") : true;
    const values: { member_id: string; field_id: string; zone_id: string; value: string }[] = [];
    const notAllowed = new Set<string>();
    inserted.forEach((m, i) => {
      for (const [key, raw] of Object.entries(customByIndex[i] ?? {})) {
        const field = fields.get(key);
        if (!field) continue;
        if (!writable(field)) {
          notAllowed.add(field.label);
          continue;
        }
        const v = normaliseFieldValue(field, raw);
        if (!v.ok) errors.push({ row: rowNumberByIndex[i], reason: `${v.error} (got "${raw}") — the rest of the row was imported` });
        else if (v.value !== null) values.push({ member_id: m.id, field_id: field.id, zone_id: profile.zoneId, value: v.value });
      }
    });
    for (let i = 0; i < values.length; i += 500) {
      const { error: valueError } = await supabase.from("member_field_values").insert(values.slice(i, i + 500));
      if (valueError) errors.push({ row: 0, reason: `Some extra details weren't saved: ${valueError.message}` });
    }
    for (const label of notAllowed) errors.push({ row: 0, reason: `"${label}" wasn't imported — only admins can fill in that field` });
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
  return { ok: true, inserted: inserted.length, errors, unmatchedCells };
}

// Cryptographically random, from characters that can't be confused when
// read off a screen. The person must replace it at first sign-in.
function randomTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[randomInt(chars.length)];
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
  if (!(await withinRateLimit(`invite:${profile.userId}`, 30, 3600))) return { ok: false, error: TOO_MANY };

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

  const position = isPosition(member.position) ? member.position : tenant.access.memberPositionKey;
  const portfolio = isPortfolio(member.portfolio) ? member.portfolio : null;
  if (isLeader(position) && !canActOn(profile.position, position)) {
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
    user_metadata: { must_change_password: true },
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

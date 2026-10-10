"use server";

import { fireHook } from "@/lib/extensions";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomAvatarColor } from "@/lib/avatar-color";
import { hasCompletedZone, setupKeyMatches } from "@/lib/setup-gate";
import type { ParsedMemberRow } from "./members";
import type { MemberRole } from "@/lib/data/types";
import { flagForCountry } from "@/lib/country-flags";
import { tenant } from "@/tenant";
import { getAutoAssignedProgramIds } from "@/lib/data/programs-server";
import { ensureEventSeries } from "@/lib/data/events";
import { CAPABILITIES, effectiveCapabilities, type Portfolio, type Position } from "@/lib/access";
import { labels } from "@/lib/labels";
import { fieldKeyFrom, memberFieldProblem, normaliseFieldValue, type MemberFieldInput } from "@/lib/custom-fields";
import { cleanColumnMapping } from "@/lib/import/column-mapping";
import type { ColumnMapping } from "@/lib/import/parse-members";

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type SetupPayload = {
  // Must match the server-only SETUP_KEY env var; the wizard reads it from ?key=.
  setupKey: string;
  zoneName: string;
  superAdmin: { name: string; email: string; phone: string; password: string };
  countries: { name: string }[];
  churchesByCountryIndex: Record<number, { name: string }[]>;
  assistants: { name: string; email: string }[];
  importedMembers?: { countryName: string; churchName: string; member: ParsedMemberRow }[];
  // Keyed `${countryName}::${churchName}`. Sub-zone and Zonal-Office flags come
  // from the roster import's review step.
  churchMeta?: Record<string, { subZoneName?: string; isOffice?: boolean }>;
  // Simple member-list import: each cell name as spelled in the sheet → the
  // cell to create for it in that member's church, or null for "not a cell".
  cellMap?: Record<string, string | null>;
  // The organisation's own member fields, made while matching the member
  // list's columns (members' values arrive in member.custom by field key),
  // and that matching, saved as the import template.
  memberFields?: (MemberFieldInput & { key: string })[];
  importTemplate?: ColumnMapping;
};

type AssistantCredential = { name: string; email: string; tempPassword: string };

export type CompleteZoneSetupResult =
  | {
      ok: true;
      zoneId: string;
      assistantCredentials: AssistantCredential[];
      importedCount: number;
    }
  | { ok: false; error: string };

function randomTempPassword(): string {
  // 12 random chars from a set that avoids visually-ambiguous characters.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += chars[randomInt(chars.length)];
  return out;
}

export async function completeZoneSetup(payload: SetupPayload): Promise<CompleteZoneSetupResult> {
  if (!setupKeyMatches(payload?.setupKey)) {
    return { ok: false, error: "This setup link is invalid or setup is disabled on this deployment." };
  }
  if (await hasCompletedZone()) {
    return { ok: false, error: "Setup has already been completed for this deployment." };
  }

  const admin = createAdminClient();

  const zoneName = payload.zoneName.trim();
  const superAdminName = payload.superAdmin.name.trim();
  const superAdminEmail = payload.superAdmin.email.trim().toLowerCase();
  if (!zoneName || !superAdminName || !superAdminEmail || !payload.superAdmin.password) {
    return { ok: false, error: `${labels.zone} name, your name, email, and password are all required.` };
  }
  if (payload.superAdmin.password.length < 10 || !/[a-zA-Z]/.test(payload.superAdmin.password) || !/\d/.test(payload.superAdmin.password)) {
    return { ok: false, error: "Use a password of at least 10 characters, with letters and numbers." };
  }

  // 1. Super Admin auth user.
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: superAdminEmail,
    password: payload.superAdmin.password,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    return { ok: false, error: authError?.message ?? "Could not create your account." };
  }

  // 2. Zone.
  const { data: zone, error: zoneError } = await admin
    .from("zones")
    .insert({ name: zoneName, setup_complete: false, display_currency: tenant.defaultCurrency })
    .select("id")
    .single();
  if (zoneError || !zone) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { ok: false, error: zoneError?.message ?? "Could not create the zone." };
  }
  const zoneId = zone.id;

  // From here on, a failure undoes everything created so far — the zone
  // (which cascades to everything in it) and every login made — so setup
  // can simply be run again rather than tripping over a half-made zone or
  // an "already registered" email.
  const createdUserIds = [authUser.user.id];
  const fail = async (error: string): Promise<CompleteZoneSetupResult> => {
    await admin.from("zones").delete().eq("id", zoneId);
    for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
    return { ok: false, error };
  };

  // 3. Super Admin profile.
  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    zone_id: zoneId,
    role: "super_admin",
    full_name: superAdminName,
    email: superAdminEmail,
    phone: payload.superAdmin.phone.trim() || null,
    // Whoever runs setup gets the tenant's root leadership position.
    position: tenant.access.rootPositionKey,
    scope: "zone",
    caps: [...CAPABILITIES],
  });
  if (profileError) {
    return fail(profileError.message);
  }

  // 4a. Sub-zones (SZ1, SZ2, ...) named in the roster review step.
  const subZoneIdByName = new Map<string, string>();
  const subZoneNames = [
    ...new Set(
      Object.values(payload.churchMeta ?? {})
        .map((m) => m.subZoneName?.trim())
        .filter((n): n is string => !!n)
    ),
  ];
  if (subZoneNames.length > 0) {
    const { data: subZones, error: subZoneError } = await admin
      .from("sub_zones")
      .insert(subZoneNames.map((name) => ({ zone_id: zoneId, name })))
      .select("id, name");
    if (subZoneError || !subZones) {
      return fail(subZoneError?.message ?? "Could not create sub-zones.");
    }
    for (const z of subZones) subZoneIdByName.set(z.name, z.id);
  }

  // 4. Countries + churches. Track name -> id so imported member rows (keyed
  // by the same names the structure was built from) can be resolved below.
  const countryIdByName = new Map<string, string>();
  const churchIdByKey = new Map<string, string>(); // key: `${countryName}::${churchName}`

  const filteredCountries = payload.countries.filter((c) => c.name.trim());
  for (let i = 0; i < filteredCountries.length; i++) {
    const name = filteredCountries[i].name.trim();
    const { data: country, error: countryError } = await admin
      .from("countries")
      .insert({ zone_id: zoneId, name, flag: flagForCountry(name) })
      .select("id")
      .single();
    if (countryError || !country) {
      return fail(countryError?.message ?? "Could not create a country.");
    }
    countryIdByName.set(name, country.id);

    const churchInputs = (payload.churchesByCountryIndex[i] ?? []).filter((c) => c.name.trim());
    if (churchInputs.length > 0) {
      const { data: churches, error: churchError } = await admin
        .from("churches")
        .insert(
          churchInputs.map((c) => {
            const meta = payload.churchMeta?.[`${name}::${c.name.trim()}`];
            return {
              zone_id: zoneId,
              country_id: country.id,
              name: c.name.trim(),
              sub_zone_id: meta?.subZoneName ? (subZoneIdByName.get(meta.subZoneName.trim()) ?? null) : null,
              is_office: meta?.isOffice === true,
            };
          })
        )
        .select("id, name");
      if (churchError || !churches) {
        return fail(churchError?.message ?? "Could not create churches.");
      }
      for (const c of churches) churchIdByKey.set(`${name}::${c.name}`, c.id);
    }
  }

  // 4a'. Cells named by a simple member-list import, created in each
  // member's church (see payload.cellMap).
  const cellIdByKey = new Map<string, string>(); // key: `${churchId}::${cellName}`
  const cellFor = (churchId: string, sheetName: string | undefined) => {
    const name = sheetName ? payload.cellMap?.[sheetName]?.trim() : undefined;
    return name ? `${churchId}::${name}` : undefined;
  };
  const wantedCells = new Map<string, { church_id: string; name: string }>();
  for (const row of payload.importedMembers ?? []) {
    const churchId = churchIdByKey.get(`${row.countryName}::${row.churchName}`);
    const key = churchId ? cellFor(churchId, row.member.cellName) : undefined;
    if (churchId && key) wantedCells.set(key, { church_id: churchId, name: key.slice(churchId.length + 2) });
  }
  if (wantedCells.size > 0) {
    const { data: cells, error: cellError } = await admin
      .from("cells")
      .insert([...wantedCells.values()].map((c) => ({ ...c, zone_id: zoneId })))
      .select("id, church_id, name");
    if (cellError || !cells) {
      return fail(cellError?.message ?? "Could not create cells.");
    }
    for (const c of cells) cellIdByKey.set(`${c.church_id}::${c.name}`, c.id);
  }

  const assistantCredentials: AssistantCredential[] = [];

  // 4a. The organisation's own member fields. Keys are kept as the wizard
  // made them (members' values refer to them) unless one is malformed.
  const fieldByKey = new Map<string, { id: string; label: string; type: MemberFieldInput["type"]; options: string[] }>();
  const fieldDrafts = (payload.memberFields ?? []).slice(0, 100);
  if (fieldDrafts.length > 0) {
    const seenKeys: string[] = [];
    const seenLabels = new Set<string>();
    const rows = [];
    for (const [i, f] of fieldDrafts.entries()) {
      const problem = memberFieldProblem(f);
      if (problem) return fail(`Member field "${f.label}": ${problem}`);
      const label = f.label.trim();
      if (seenLabels.has(label.toLowerCase())) return fail(`There are two member fields called "${label}".`);
      seenLabels.add(label.toLowerCase());
      const key = /^[a-z][a-z0-9_]{0,49}$/.test(f.key) && !seenKeys.includes(f.key) ? f.key : fieldKeyFrom(label, seenKeys);
      seenKeys.push(key);
      rows.push({
        zone_id: zoneId,
        key,
        label,
        type: f.type,
        options: f.type === "select" ? f.options.map((o) => o.trim()).filter(Boolean) : [],
        visibility: f.visibility,
        member_access: f.memberAccess,
        sort_order: i + 1,
      });
    }
    const { data: created, error: fieldsError } = await admin.from("member_fields").insert(rows).select("id, key, label, type, options");
    if (fieldsError || !created) return fail(fieldsError?.message ?? "Could not create the member fields.");
    for (const f of created) fieldByKey.set(f.key, { id: f.id, label: f.label, type: f.type, options: f.options ?? [] });
  }
  const template = cleanColumnMapping(payload.importTemplate);
  if (Object.keys(template).length > 0) {
    await admin.from("import_templates").insert({ zone_id: zoneId, kind: "members", mapping: template, updated_by: authUser.user.id });
  }

  // 4b. Imported members, if the wizard's import step supplied any —
  // resolved against the countries/churches just created above.
  let importedCount = 0;
  const createdMemberIds: string[] = [];
  if (payload.importedMembers && payload.importedMembers.length > 0) {
    type MemberInsert = {
      zone_id: string;
      church_id: string;
      country_id: string;
      first_name: string;
      last_name: string;
      email: string | null;
      phone: string | null;
      role: MemberRole;
      position: Position;
      portfolio: Portfolio | null;
      avatar_color: string;
      title: string | null;
      kc_handle: string | null;
      profession: string | null;
      spouse_name: string | null;
      birthday: string | null;
      wedding_anniversary: string | null;
      age_group: string | null;
      cell_id: string | null;
    };
    const toInsert: MemberInsert[] = [];
    const givingByRow: (number | undefined)[] = [];
    const givingMonthByRow: (string | undefined)[] = [];
    const customByRow: (Record<string, string> | undefined)[] = [];

    for (const row of payload.importedMembers) {
      const countryId = countryIdByName.get(row.countryName);
      const churchId = churchIdByKey.get(`${row.countryName}::${row.churchName}`);
      if (!countryId || !churchId) continue; // structure row didn't survive filtering — skip silently
      toInsert.push({
        zone_id: zoneId,
        church_id: churchId,
        country_id: countryId,
        first_name: row.member.firstName,
        last_name: row.member.lastName,
        email: row.member.email ?? null,
        phone: row.member.phone ?? null,
        role: row.member.role ?? "Member",
        position: row.member.position ?? "member",
        portfolio: row.member.portfolio ?? null,
        avatar_color: randomAvatarColor(),
        title: row.member.title ?? null,
        kc_handle: row.member.kcHandle ?? null,
        profession: row.member.profession ?? null,
        spouse_name: row.member.spouseName ?? null,
        birthday: row.member.birthday ?? null,
        wedding_anniversary: row.member.weddingAnniversary ?? null,
        age_group: row.member.ageGroup ?? null,
        cell_id: cellIdByKey.get(cellFor(churchId, row.member.cellName) ?? "") ?? null,
      });
      givingByRow.push(row.member.givingTotal && row.member.givingTotal > 0 ? row.member.givingTotal : undefined);
      givingMonthByRow.push((row.member.givingDate ?? new Date().toISOString().slice(0, 10)).slice(0, 7));
      customByRow.push(row.member.custom);
    }

    const defaultProgramIds = await getAutoAssignedProgramIds(zoneId);

    for (const batch of chunk(toInsert, 400)) {
      const { data: inserted, error: memberError } = await admin.from("members").insert(batch).select("id, email, first_name, last_name");
      if (memberError || !inserted) {
        return fail(memberError?.message ?? "Member import failed partway through.");
      }
      importedCount += inserted.length;
      createdMemberIds.push(...inserted.map((m) => m.id));

      const offset = toInsert.indexOf(batch[0]);
      const trainingRows = inserted.flatMap((m) =>
        defaultProgramIds.map((program_id) => ({ member_id: m.id, zone_id: zoneId, program_id, status: "not_started" as const }))
      );
      const givingRows = inserted
        .map((m, i) => ({
          member_id: m.id,
          zone_id: zoneId,
          month: givingMonthByRow[offset + i]!,
          amount: givingByRow[offset + i],
        }))
        .filter((g): g is { member_id: string; zone_id: string; month: string; amount: number } => g.amount !== undefined);

      for (const tBatch of chunk(trainingRows, 500)) {
        await admin.from("trainings").insert(tBatch);
      }
      if (givingRows.length > 0) {
        await admin.from("giving_entries").insert(givingRows);
      }

      // Their values for the organisation's own fields. One that doesn't
      // fit the field (a word in a date column) is left out, not fatal.
      const valueRows = inserted.flatMap((m, i) =>
        Object.entries(customByRow[offset + i] ?? {}).flatMap(([key, raw]) => {
          const field = fieldByKey.get(key);
          const value = field ? normaliseFieldValue(field, raw) : null;
          return field && value?.ok && value.value !== null
            ? [{ member_id: m.id, field_id: field.id, zone_id: zoneId, value: value.value }]
            : [];
        })
      );
      for (const vBatch of chunk(valueRows, 500)) {
        await admin.from("member_field_values").insert(vBatch);
      }

      // Positions are recorded on the member rows, but no logins are created
      // here — someone at the right level invites each leader when they
      // actually need access. The one exception is the person running setup:
      // link their own member row (if they're in the roster) to their login.
      for (let i = 0; i < inserted.length; i++) {
        if (inserted[i].email?.trim().toLowerCase() === superAdminEmail) {
          await admin.from("members").update({ profile_id: authUser.user.id }).eq("id", inserted[i].id);
        }
      }
    }

    if (importedCount > 0) {
      await admin.from("activity").insert({
        zone_id: zoneId,
        type: "new_member",
        message: `${importedCount} members imported during zone setup`,
      });
    }
  }

  // 5. Assistants.
  for (const a of payload.assistants) {
    const name = a.name.trim();
    const email = a.email.trim().toLowerCase();
    if (!name || !email) continue;

    const tempPassword = randomTempPassword();
    const { data: assistantUser, error: assistantAuthError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      // Must choose their own password at first sign-in.
      user_metadata: { must_change_password: true },
    });
    if (assistantUser?.user) createdUserIds.push(assistantUser.user.id);
    if (assistantAuthError || !assistantUser.user) {
      // Don't fail the whole setup over one bad assistant email — surface it
      // via a credential row with an empty password so the UI can flag it.
      assistantCredentials.push({ name, email, tempPassword: "" });
      continue;
    }

    const { error: assistantProfileError } = await admin.from("profiles").insert({
      id: assistantUser.user.id,
      zone_id: zoneId,
      role: "super_admin",
      full_name: name,
      email,
      position: tenant.access.assistantPositionKey,
      scope: "zone",
      caps: effectiveCapabilities(tenant.access.assistantPositionKey, null),
    });
    if (assistantProfileError) {
      assistantCredentials.push({ name, email, tempPassword: "" });
      continue;
    }

    assistantCredentials.push({ name, email, tempPassword });
  }

  // 5b. The five annual flagship events (Zonal Convention, Camp Meeting, ...).
  await ensureEventSeries(zoneId);

  // 6. Mark zone ready.
  const { error: completeError } = await admin.from("zones").update({ setup_complete: true }).eq("id", zoneId);
  if (completeError) {
    return fail(completeError.message);
  }

  if (createdMemberIds.length > 0) fireHook("onMembersCreated", { zoneId, memberIds: createdMemberIds, source: "setup" });
  return { ok: true, zoneId, assistantCredentials, importedCount };
}

"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ParsedMemberRow } from "./members";
import type { MemberRole } from "@/lib/data/types";
import { flagForCountry } from "@/lib/zone-countries";
import { getAutoAssignedProgramIds } from "@/lib/data/programs-server";
import { ensureEventSeries } from "@/lib/data/events";
import { CAPABILITIES, effectiveCapabilities, type Portfolio, type Position } from "@/lib/access";

const AVATAR_COLORS = ["#7c3aed", "#a21caf", "#9333ea", "#be185d", "#6d28d9", "#c026d3", "#8b5cf6"];

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type SetupPayload = {
  zoneName: string;
  superAdmin: { name: string; email: string; phone: string; password: string };
  countries: { name: string }[];
  churchesByCountryIndex: Record<number, { name: string }[]>;
  assistants: { name: string; email: string }[];
  importedMembers?: { countryName: string; churchName: string; member: ParsedMemberRow }[];
  // Keyed `${countryName}::${churchName}`. Sub-zone and Zonal-Office flags come
  // from the roster import's review step.
  churchMeta?: Record<string, { subZoneName?: string; isOffice?: boolean }>;
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
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function completeZoneSetup(payload: SetupPayload): Promise<CompleteZoneSetupResult> {
  const admin = createAdminClient();

  const zoneName = payload.zoneName.trim();
  const superAdminName = payload.superAdmin.name.trim();
  const superAdminEmail = payload.superAdmin.email.trim().toLowerCase();
  if (!zoneName || !superAdminName || !superAdminEmail || !payload.superAdmin.password) {
    return { ok: false, error: "Zone name, your name, email, and password are all required." };
  }
  if (payload.superAdmin.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
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
    .insert({ name: zoneName, setup_complete: false })
    .select("id")
    .single();
  if (zoneError || !zone) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return { ok: false, error: zoneError?.message ?? "Could not create the zone." };
  }
  const zoneId = zone.id;

  // 3. Super Admin profile.
  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    zone_id: zoneId,
    role: "super_admin",
    full_name: superAdminName,
    email: superAdminEmail,
    phone: payload.superAdmin.phone.trim() || null,
    // Whoever runs setup is the Zonal Director.
    position: "zonal_director",
    scope: "zone",
    caps: [...CAPABILITIES],
  });
  if (profileError) {
    return { ok: false, error: profileError.message };
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
      return { ok: false, error: subZoneError?.message ?? "Could not create sub-zones." };
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
      return { ok: false, error: countryError?.message ?? "Could not create a country." };
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
        return { ok: false, error: churchError?.message ?? "Could not create churches." };
      }
      for (const c of churches) churchIdByKey.set(`${name}::${c.name}`, c.id);
    }
  }

  const assistantCredentials: AssistantCredential[] = [];

  // 4b. Imported members, if the wizard's import step supplied any —
  // resolved against the countries/churches just created above.
  let importedCount = 0;
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
    };
    const toInsert: MemberInsert[] = [];
    const givingByRow: (number | undefined)[] = [];
    const givingMonthByRow: (string | undefined)[] = [];

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
        avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        title: row.member.title ?? null,
        kc_handle: row.member.kcHandle ?? null,
        profession: row.member.profession ?? null,
        spouse_name: row.member.spouseName ?? null,
        birthday: row.member.birthday ?? null,
        wedding_anniversary: row.member.weddingAnniversary ?? null,
      });
      givingByRow.push(row.member.givingTotal && row.member.givingTotal > 0 ? row.member.givingTotal : undefined);
      givingMonthByRow.push((row.member.givingDate ?? new Date().toISOString().slice(0, 10)).slice(0, 7));
    }

    const defaultProgramIds = await getAutoAssignedProgramIds(zoneId);

    for (const batch of chunk(toInsert, 400)) {
      const { data: inserted, error: memberError } = await admin.from("members").insert(batch).select("id, email, first_name, last_name");
      if (memberError || !inserted) {
        return { ok: false, error: memberError?.message ?? "Member import failed partway through." };
      }
      importedCount += inserted.length;

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
    });
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
      position: "assistant_zonal_director",
      scope: "zone",
      caps: effectiveCapabilities("assistant_zonal_director", null),
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
    return { ok: false, error: completeError.message };
  }

  return { ok: true, zoneId, assistantCredentials, importedCount };
}

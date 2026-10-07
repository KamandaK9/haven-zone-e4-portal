"use server";

import { revalidatePath } from "next/cache";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { fieldKeyFrom, normaliseFieldValue, type MemberField } from "@/lib/custom-fields";
import { mapMemberField } from "@/lib/data/member-fields";
import type { ColumnMapping } from "@/lib/import/parse-members";
import { createClient } from "@/lib/supabase/server";
import type { MemberFieldAccess, MemberFieldType, MemberFieldVisibility } from "@/lib/supabase/types";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

const TYPES: MemberFieldType[] = ["text", "number", "date", "select", "yes_no"];
const VISIBILITIES: MemberFieldVisibility[] = ["leaders", "contact", "admins"];
const ACCESS: MemberFieldAccess[] = ["hidden", "view", "edit"];

export type MemberFieldInput = {
  label: string;
  type: MemberFieldType;
  options: string[];
  visibility: MemberFieldVisibility;
  memberAccess: MemberFieldAccess;
};

function check(input: MemberFieldInput): string | null {
  if (!input.label.trim()) return "Give the field a name.";
  if (input.label.trim().length > 80) return "Keep the name under 80 characters.";
  if (!TYPES.includes(input.type) || !VISIBILITIES.includes(input.visibility) || !ACCESS.includes(input.memberAccess)) return "Invalid field settings.";
  const options = input.options.map((o) => o.trim()).filter(Boolean);
  if (input.type === "select" && options.length < 2) return "A choice field needs at least two options.";
  if (options.some((o) => o.length > 80) || options.length > 50) return "Keep options short (up to 50 of them).";
  return null;
}

async function requireSettingsAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!can(profile, "manage_settings")) return { ok: false as const, error: "Only admins who manage settings can change member fields." };
  return { ok: true as const, profile, supabase: await createClient() };
}

export async function createMemberField(input: MemberFieldInput): Promise<{ ok: true; field: MemberField } | { ok: false; error: string }> {
  const problem = check(input);
  if (problem) return { ok: false, error: problem };
  const auth = await requireSettingsAdmin();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;

  const { data: existing } = await supabase.from("member_fields").select("key, label, sort_order").eq("zone_id", profile.zoneId);
  if ((existing ?? []).some((f) => f.label.trim().toLowerCase() === input.label.trim().toLowerCase())) {
    return { ok: false, error: `There's already a field called "${input.label.trim()}".` };
  }
  const { data, error } = await supabase
    .from("member_fields")
    .insert({
      zone_id: profile.zoneId,
      key: fieldKeyFrom(input.label, (existing ?? []).map((f) => f.key)),
      label: input.label.trim(),
      type: input.type,
      options: input.type === "select" ? input.options.map((o) => o.trim()).filter(Boolean) : [],
      visibility: input.visibility,
      member_access: input.memberAccess,
      sort_order: Math.max(0, ...(existing ?? []).map((f) => f.sort_order)) + 1,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't add the field." };

  await logAudit(profile, "member_field.create", `Added the member field "${data.label}"`, { entity: { type: "member_field", id: data.id } });
  revalidatePath("/", "layout");
  return { ok: true, field: mapMemberField(data) };
}

// The type and key can't change once a field exists (values are stored in
// that form); everything else can.
export async function updateMemberField(fieldId: string, input: Omit<MemberFieldInput, "type"> & { archived: boolean }): Promise<ActionResult> {
  const auth = await requireSettingsAdmin();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const { data: field } = await supabase.from("member_fields").select("type, label").eq("id", fieldId).maybeSingle();
  if (!field) return { ok: false, error: "That field no longer exists." };
  const problem = check({ ...input, type: field.type });
  if (problem) return { ok: false, error: problem };

  const { error } = await supabase
    .from("member_fields")
    .update({
      label: input.label.trim(),
      options: field.type === "select" ? input.options.map((o) => o.trim()).filter(Boolean) : [],
      visibility: input.visibility,
      member_access: input.memberAccess,
      archived: input.archived,
    })
    .eq("id", fieldId);
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "member_field.update", `${input.archived ? "Archived" : "Edited"} the member field "${input.label.trim()}"`, {
    entity: { type: "member_field", id: fieldId },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Saves how this organisation's spreadsheet columns map onto members.
export async function saveImportTemplate(mapping: ColumnMapping): Promise<ActionResult> {
  const auth = await requireSettingsAdmin();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const clean: ColumnMapping = {};
  for (const [k, v] of Object.entries(mapping).slice(0, 200)) {
    if (typeof v === "string" && /^(skip|builtin:[a-zA-Z]+|custom:[a-z][a-z0-9_]*)$/.test(v) && k.length <= 120) clean[k] = v;
  }
  const { error } = await supabase
    .from("import_templates")
    .upsert({ zone_id: profile.zoneId, kind: "members", mapping: clean, updated_by: profile.userId, updated_at: new Date().toISOString() }, { onConflict: "zone_id,kind" });
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "import_template.update", "Saved the member import template");
  return { ok: true };
}

// Sets (or clears, with null) one member's values for the given fields.
// RLS decides which fields this person may write for this member.
export async function setMemberFieldValues(memberId: string, values: Record<string, string | null>): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  const supabase = await createClient();
  const ids = Object.keys(values);
  if (ids.length === 0) return { ok: true };
  const { data: fields } = await supabase.from("member_fields").select("*").in("id", ids);
  const byId = new Map((fields ?? []).map((f) => [f.id, mapMemberField(f)]));

  const upserts: { member_id: string; field_id: string; zone_id: string; value: string; updated_at: string }[] = [];
  const clears: string[] = [];
  for (const [fieldId, raw] of Object.entries(values)) {
    const field = byId.get(fieldId);
    if (!field) return { ok: false, error: "One of those fields no longer exists." };
    const result = normaliseFieldValue(field, raw);
    if (!result.ok) return { ok: false, error: result.error };
    if (result.value === null) clears.push(fieldId);
    else upserts.push({ member_id: memberId, field_id: fieldId, zone_id: profile.zoneId, value: result.value, updated_at: new Date().toISOString() });
  }

  if (upserts.length > 0) {
    const { data, error } = await supabase.from("member_field_values").upsert(upserts, { onConflict: "member_id,field_id" }).select("field_id");
    if (error || (data ?? []).length !== upserts.length) return { ok: false, error: "You can't change one of those details." };
  }
  if (clears.length > 0) {
    const { error } = await supabase.from("member_field_values").delete().eq("member_id", memberId).in("field_id", clears);
    if (error) return { ok: false, error: error.message };
  }
  if (profile.role !== "member") await logAudit(profile, "member.update_fields", "Edited a member's details", { entity: { type: "member", id: memberId } });
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/me/profile");
  return { ok: true };
}

// Forgets the saved column choices; the next import starts from guesses.
export async function clearImportTemplate(): Promise<ActionResult> {
  const auth = await requireSettingsAdmin();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const { error } = await supabase.from("import_templates").delete().eq("zone_id", profile.zoneId).eq("kind", "members");
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "import_template.update", "Cleared the member import template");
  revalidatePath("/settings/fields");
  return { ok: true };
}

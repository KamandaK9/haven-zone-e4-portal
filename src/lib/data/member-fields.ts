import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemberField } from "@/lib/custom-fields";
import type { ColumnMapping } from "@/lib/import/parse-members";
import type { Database } from "@/lib/supabase/types";

type FieldRow = Database["public"]["Tables"]["member_fields"]["Row"];

export function mapMemberField(f: FieldRow): MemberField {
  return {
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type,
    options: f.options ?? [],
    visibility: f.visibility,
    memberAccess: f.member_access,
    sortOrder: f.sort_order,
    archived: f.archived,
  };
}

// The organisation's own member fields (archived ones included, flagged).
// Empty if the table doesn't exist yet (migration not applied).
export async function getMemberFields(zoneId: string): Promise<MemberField[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("member_fields").select("*").eq("zone_id", zoneId).order("sort_order").order("label");
  if (error) return [];
  return data.map(mapMemberField);
}

// Values the viewer may see (RLS applies each field's visibility), by
// member id → field id → value.
export async function getMemberFieldValues(memberIds: string[]): Promise<Map<string, Record<string, string>>> {
  const out = new Map<string, Record<string, string>>();
  if (memberIds.length === 0) return out;
  const supabase = await createClient();
  for (let i = 0; i < memberIds.length; i += 500) {
    const { data } = await supabase
      .from("member_field_values")
      .select("member_id, field_id, value")
      .in("member_id", memberIds.slice(i, i + 500));
    for (const v of data ?? []) out.set(v.member_id, { ...(out.get(v.member_id) ?? {}), [v.field_id]: v.value });
  }
  return out;
}

export async function getImportTemplate(zoneId: string): Promise<ColumnMapping | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("import_templates").select("mapping").eq("zone_id", zoneId).eq("kind", "members").maybeSingle();
  return data?.mapping && typeof data.mapping === "object" && !Array.isArray(data.mapping) ? (data.mapping as ColumnMapping) : null;
}

// One member's own-field values the caller may see, as label → value, for
// data exports (archived fields included — the values are still held).
export async function getMemberDetailsForExport(memberId: string, zoneId: string): Promise<Record<string, string>> {
  const [fields, values] = await Promise.all([getMemberFields(zoneId), getMemberFieldValues([memberId])]);
  const own = values.get(memberId) ?? {};
  const out: Record<string, string> = {};
  for (const f of fields) if (own[f.id] !== undefined) out[f.archived ? `${f.label} (archived)` : f.label] = own[f.id];
  return out;
}

import type { MemberField } from "@/lib/custom-fields";
import { HEADER_ALIASES, type BuiltinMemberField, type ColumnMapping } from "./parse-members";
import { normalizeHeader, type SheetTable } from "./read-table-file";

// The column-matching step of a member import: what each of the sheet's
// columns becomes. Pure — the import dialog and setup use it.

export type ImportColumn = { header: string; key: string; samples: string[] };

// Built-in member details a column can fill. Labels for the structure-level
// ones (cell, age group) come from the caller, which knows the tenant.
export const BUILTIN_TARGETS: { field: BuiltinMemberField; label: string }[] = [
  { field: "firstName", label: "First name" },
  { field: "lastName", label: "Surname" },
  { field: "fullName", label: "Full name (split into first name and surname)" },
  { field: "email", label: "Email" },
  { field: "phone", label: "Phone" },
  { field: "title", label: "Title" },
  { field: "birthday", label: "Birthday" },
  { field: "joinDate", label: "Date joined" },
  { field: "role", label: "Role" },
  { field: "cellName", label: "Cell" },
  { field: "ageGroup", label: "Age group" },
  { field: "profession", label: "Profession" },
  { field: "spouseName", label: "Spouse's name" },
  { field: "weddingAnniversary", label: "Wedding anniversary" },
  { field: "kcHandle", label: "KingsChat handle" },
  { field: "givingTotal", label: "Giving amount" },
  { field: "givingDate", label: "Giving date" },
];

// Every distinct column across the sheets, in order, with a few sample
// values each (blank cells skipped).
export function importColumns(sheets: readonly SheetTable[], sampleCount = 5): ImportColumn[] {
  const byKey = new Map<string, ImportColumn>();
  for (const sheet of sheets) {
    sheet.headers.forEach((header, i) => {
      const key = normalizeHeader(header);
      if (!key) return;
      const col = byKey.get(key) ?? { header: header.trim(), key, samples: [] };
      for (const row of sheet.rows) {
        if (col.samples.length >= sampleCount) break;
        const v = row[i]?.trim();
        if (v && !col.samples.includes(v)) col.samples.push(v);
      }
      byKey.set(key, col);
    });
  }
  return [...byKey.values()];
}

// A first mapping for these columns: the organisation's saved template
// first, then recognised header names, then a custom field with the same
// label; anything else is skipped. Each built-in field is used once.
export function suggestMapping(
  columns: readonly ImportColumn[],
  { template, fields }: { template?: ColumnMapping | null; fields: readonly Pick<MemberField, "key" | "label" | "archived">[] }
): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const liveFieldKeys = new Set(fields.filter((f) => !f.archived).map((f) => f.key));
  const take = (key: string, target: string) => {
    if (target.startsWith("builtin:") && used.has(target)) return false;
    if (target.startsWith("custom:") && !liveFieldKeys.has(target.slice(7))) return false;
    mapping[key] = target;
    if (target !== "skip") used.add(target);
    return true;
  };

  for (const col of columns) {
    const saved = template?.[col.key];
    if (saved && take(col.key, saved)) continue;
    const builtin = (Object.entries(HEADER_ALIASES) as [BuiltinMemberField, string[]][]).find(([, aliases]) => aliases.includes(col.key));
    if (builtin && take(col.key, `builtin:${builtin[0]}`)) continue;
    const field = fields.find((f) => !f.archived && normalizeHeader(f.label) === col.key);
    if (field && take(col.key, `custom:${field.key}`)) continue;
    mapping[col.key] = "skip";
  }
  return mapping;
}

// What has to be true before importing with this mapping.
export function mappingProblem(mapping: ColumnMapping): string | null {
  const targets = Object.values(mapping);
  if (!targets.includes("builtin:firstName") && !targets.includes("builtin:fullName")) {
    return "Choose which column holds people's names (First name, or Full name).";
  }
  const builtins = targets.filter((t) => t.startsWith("builtin:"));
  const dupe = builtins.find((t, i) => builtins.indexOf(t) !== i);
  if (dupe) return `Two columns are set to the same detail (${dupe.slice(8)}) — pick one.`;
  return null;
}

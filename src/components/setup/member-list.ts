import { tenant } from "@/tenant";
import { parseZoneMemberSheet } from "@/lib/import/parse-zone-members";
import { memberSheets, parseMemberSheets, type ColumnMapping } from "@/lib/import/parse-members";
import { importColumns, mappingProblem, suggestMapping, type ImportColumn } from "@/lib/import/column-mapping";
import { fieldKeyFrom, memberFieldProblem, type MemberField, type MemberFieldInput } from "@/lib/custom-fields";
import { clusterCellNames, type CellCluster } from "@/lib/import/cluster-cells";
import type { ParsedMemberRow } from "@/lib/actions/members";
import type { WizardState } from "./types";

// Reading an organisation's member sheet into the setup wizard. Shared by the
// "Import members" step and the "Countries & churches" step, so a member list
// dropped on either one is taken — never bounced back.

export type CellChoice = { action: "create" | "none" | "merge"; name: string; into?: string };

// A member list with no Country/Church columns: everyone goes into one
// church, chosen when setup is submitted (see resolveMemberList), so editing
// the church name afterwards can't strand them.
export type MemberList = {
  fileName: string;
  // The sheet as read, and what each column becomes — changed on the Import
  // members step, which re-reads the members from it.
  sheets: Awaited<ReturnType<typeof memberSheets>>;
  columns: ImportColumn[];
  mapping: ColumnMapping;
  members: ParsedMemberRow[];
  skipped: number;
  ignored: string[];
  ageGroups: Record<string, number>; // label → count
  clusters: CellCluster[];
  choices: Record<string, CellChoice>; // keyed by cluster name
  target?: string; // `${country}::${church}`; the first church if unset/stale
};

export type LoadResult =
  | { ok: true; kind: "zoned" | "list"; summary: string; apply: (w: WizardState) => WizardState }
  | { ok: false; error: string };

export async function loadMemberSheet(file: File): Promise<LoadResult> {
  try {
    // With Country and Church columns, the sheet places members itself and
    // defines the structure.
    const zoned = await parseZoneMemberSheet(file);
    if (zoned.rows.length > 0) {
      const churches = zoned.countries.reduce((sum, c) => sum + c.churches.length, 0);
      return {
        ok: true,
        kind: "zoned",
        summary: `${zoned.rows.length.toLocaleString()} members across ${zoned.countries.length} countries and ${churches} churches — the country/church list now matches the file.`,
        apply: (w) => ({ ...w, importFileName: file.name, countries: zoned.countries, importedMembers: zoned.rows, memberList: null }),
      };
    }

    const sheets = await memberSheets(file);
    const columns = importColumns(sheets.sheets);
    if (columns.length === 0 || sheets.sheets.every((s) => s.rows.length === 0)) {
      return { ok: false, error: "No rows found in that file." };
    }
    const preview = memberListFrom(file.name, sheets, columns, suggestMapping(columns, { fields: [] }));
    return {
      ok: true,
      kind: "list",
      summary:
        preview.members.length > 0
          ? `${preview.members.length.toLocaleString()} members found${preview.skipped > 0 ? ` (${preview.skipped} row(s) skipped — no name)` : ""}.`
          : "Read the file — choose which column holds names on the Import members step.",
      // Matched against any fields already made in this setup.
      apply: (w) =>
        ensureAChurch({
          ...w,
          importFileName: file.name,
          importedMembers: [],
          memberList: memberListFrom(file.name, sheets, columns, suggestMapping(columns, { fields: w.memberFields })),
        }),
    };
  } catch {
    return { ok: false, error: "Couldn't read that file. Make sure it's a valid .xlsx, .xls, or .csv." };
  }
}

// Reads the members out of the sheet with this column mapping. Given the
// list it replaces, keeps the chosen church and any cell decisions that still
// apply.
export function memberListFrom(
  fileName: string,
  sheets: MemberList["sheets"],
  columns: ImportColumn[],
  mapping: ColumnMapping,
  previous?: MemberList | null
): MemberList {
  // No name column chosen yet: nobody to import until there is.
  const parsed = mappingProblem(mapping) ? null : parseMemberSheets(sheets, mapping);
  const rows = parsed?.rows ?? [];
  const clusters = clusterCellNames(rows.map((r) => r.cellName));
  const ageGroups: Record<string, number> = {};
  for (const r of rows) {
    const label = tenant.ageGroups?.find((g) => g.key === r.ageGroup)?.label;
    if (label) ageGroups[label] = (ageGroups[label] ?? 0) + 1;
  }
  return {
    fileName,
    sheets,
    columns,
    mapping,
    members: rows,
    skipped: parsed?.skipped.length ?? 0,
    ignored: columns.filter((c) => (mapping[c.key] ?? "skip") === "skip").map((c) => c.header),
    ageGroups,
    clusters,
    choices: Object.fromEntries(
      clusters.map((c) => [c.name, previous?.choices[c.name] ?? { action: c.likelyCell ? "create" : "none", name: c.name }])
    ),
    target: previous?.target,
  };
}

// A field made while matching columns in setup: kept in the wizard, and
// created when setup is submitted.
export function draftMemberField(input: MemberFieldInput, existing: MemberField[]): { ok: true; field: MemberField } | { ok: false; error: string } {
  const problem = memberFieldProblem(input);
  if (problem) return { ok: false, error: problem };
  if (existing.some((f) => f.label.trim().toLowerCase() === input.label.trim().toLowerCase())) {
    return { ok: false, error: `There's already a field called "${input.label.trim()}".` };
  }
  const key = fieldKeyFrom(input.label, existing.map((f) => f.key));
  return {
    ok: true,
    field: {
      id: `draft:${key}`,
      key,
      label: input.label.trim(),
      type: input.type,
      options: input.type === "select" ? input.options.map((o) => o.trim()).filter(Boolean) : [],
      visibility: input.visibility,
      memberAccess: input.memberAccess,
      sortOrder: existing.length + 1,
      archived: false,
    },
  };
}

export function churchOptions(w: WizardState): { key: string; country: string; church: string }[] {
  return w.countries.flatMap((c) =>
    c.name.trim()
      ? c.churches.filter((n) => n.trim()).map((ch) => ({ key: `${c.name.trim()}::${ch.trim()}`, country: c.name.trim(), church: ch.trim() }))
      : []
  );
}

// A member list needs a church to go into: if none has been entered yet, add
// one named after the organisation (editable on the Countries & churches step).
function ensureAChurch(w: WizardState): WizardState {
  if (churchOptions(w).length > 0) return w;
  const named = w.countries.findIndex((c) => c.name.trim());
  if (named !== -1) {
    return {
      ...w,
      countries: w.countries.map((c, i) => (i === named ? { ...c, churches: [...c.churches.filter((n) => n.trim()), tenant.defaultOrgName] } : c)),
    };
  }
  return { ...w, countries: [...w.countries.filter((c) => c.name.trim()), { name: tenant.countries[0]?.name ?? "Country", churches: [tenant.defaultOrgName] }] };
}

// Every spelling in the sheet → the cell it ends up as, or null.
export function cellMapFor(list: MemberList): Record<string, string | null> {
  const resolve = (c: CellCluster, seen: Set<string>): string | null => {
    const choice = list.choices[c.name];
    if (!choice || choice.action === "none") return null;
    if (choice.action === "merge") {
      const into = list.clusters.find((x) => x.name === choice.into);
      return into && !seen.has(into.name) ? resolve(into, seen.add(c.name)) : null;
    }
    return choice.name.trim() || c.name;
  };
  const map: Record<string, string | null> = {};
  for (const c of list.clusters) for (const v of c.variants) map[v] = resolve(c, new Set());
  return map;
}

// What setup submits for a member list: every member placed in its church.
export function resolveMemberList(w: WizardState): Pick<WizardState, "importedMembers"> & { cellMap: Record<string, string | null> } {
  const list = w.memberList;
  if (!list) return { importedMembers: w.importedMembers, cellMap: {} };
  const options = churchOptions(w);
  const home = options.find((o) => o.key === list.target) ?? options[0];
  if (!home) return { importedMembers: [], cellMap: {} };
  return {
    importedMembers: list.members.map((member) => ({ countryName: home.country, churchName: home.church, member })),
    cellMap: cellMapFor(list),
  };
}

export function memberCount(w: WizardState): number {
  return w.memberList ? w.memberList.members.length : w.importedMembers.length;
}

import type { MemberRole } from "@/lib/data/types";
import { MEMBER_STATUSES } from "@/lib/statuses";
import type { ParsedMemberRow } from "@/lib/actions/members";
import { tenant } from "@/tenant";
import { nameKey, namesAgree } from "@/lib/name-match";
import { buildHeaderMap, normalizeHeader, readAllExcelSheets, readTableFile, type SheetTable, type TableFile } from "./read-table-file";

const ROLE_VALUES = MEMBER_STATUSES;

// Header aliases, matched case-insensitively with whitespace collapsed —
// this is the "reads the file's own headers" auto-detection. Every column is
// optional: a header that isn't here is ignored, and a field whose header
// isn't in the file is just left empty. Only a first name is required.
//
// "Cell" means the person's cell group (as church member sheets use it), not a
// cellphone — phone columns are matched by their "phone"/"mobile" names.
type Field = Exclude<keyof ParsedMemberRow, "custom"> | "fullName";
export type BuiltinMemberField = Field;

// How an organisation's columns map onto members, keyed by normalised
// column name (normalizeHeader): "builtin:<field>", "custom:<field key>"
// (an organisation's own member field) or "skip". Built in the import's
// column-matching step and saved as the organisation's template.
export type ColumnMapping = Record<string, string>;

export const HEADER_ALIASES: Partial<Record<Field, string[]>> = {
  firstName: ["first name", "firstname", "first", "name", "given name", "first names"],
  lastName: ["last name", "lastname", "surname", "last", "family name"],
  fullName: ["full name", "fullname", "name and surname", "member name"],
  email: ["email", "email address", "e-mail", "e-mail address"],
  phone: ["phone", "phone number", "mobile", "mobile number", "cellphone", "cell phone", "cell number", "contact number", "tel"],
  joinDate: ["join date", "date joined", "joined"],
  role: ["role", "member role", "status"],
  givingTotal: ["giving amount", "giving total", "total giving"],
  givingDate: ["giving date", "last giving date"],
  title: ["title"],
  birthday: ["birthday", "date of birth", "dob", "birth date"],
  // Plus whatever this organisation calls its smallest group ("Team").
  cellName: [...new Set(["cell", "cell group", "cell name", tenant.labels.cell.toLowerCase(), `${tenant.labels.cell.toLowerCase()} name`])],
  ageGroup: ["age group", "age band", "category"],
  profession: ["profession", "occupation", "job"],
  spouseName: ["spouse", "spouse name", "name of spouse", "husband", "wife"],
  weddingAnniversary: ["wedding anniversary", "anniversary"],
  kcHandle: ["kc handle", "kingschat", "kingschat handle"],
  guardianName: ["guardian", "guardian name", "parent", "parent name", "parent/guardian"],
  guardianPhone: ["guardian phone", "guardian number", "guardian cell", "parent phone", "parent number", "parent cell", "guardian contact"],
};

// The column → field positions for one sheet: from the organisation's
// mapping when there is one, otherwise by recognising header names.
function resolveColumns(headers: string[], mapping?: ColumnMapping) {
  if (!mapping) return { builtin: buildHeaderMap(headers, HEADER_ALIASES), custom: [] as [string, number][] };
  const builtin: Partial<Record<Field, number>> = {};
  const custom: [string, number][] = [];
  headers.forEach((h, i) => {
    const target = mapping[normalizeHeader(h)];
    if (target?.startsWith("builtin:")) {
      const field = target.slice(8) as Field;
      if (!(field in builtin)) builtin[field] = i;
    } else if (target?.startsWith("custom:")) {
      custom.push([target.slice(7), i]);
    }
  });
  return { builtin, custom };
}

// "Teens", "teen", "TEENS " → the tenant's "teens" age group.
export function ageGroupFor(raw: string | undefined): string | undefined {
  const k = raw?.trim().toLowerCase().replace(/s$/, "");
  if (!k) return undefined;
  return tenant.ageGroups?.find((g) => [g.key, g.label].some((n) => n.toLowerCase().replace(/s$/, "") === k))?.key;
}

// Placeholder values people type into a cell they had nothing for.
const BLANKS = new Set(["n/a", "na", "none", "nil", "-", "--", "0"]);
const clean = (raw: string | undefined) => {
  const v = raw?.replace(/\s+/g, " ").trim();
  return v && !BLANKS.has(v.toLowerCase()) ? v : undefined;
};

// Excel dates already arrive as "YYYY-MM-DD" (read-table-file). Anything
// typed is parsed as a local date and kept as one — going through
// toISOString() would shift it a day east of UTC (SAST: 12 April → 11 April).
export function parseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Sheets often hold only a day and month, which Excel completes with the
// year it was typed in — so a "birthday" in the last year or the future
// means the year is unknown, and only "MM-DD" is kept.
// Typed text with no year ("12 April") is also day-and-month only — the date
// parser would otherwise fill in a default year (2001).
function parseBirthday(raw: string | undefined): string | undefined {
  const iso = parseDate(raw);
  if (!iso) return undefined;
  const yearUnknown = !/\d{4}/.test(raw!) || Number(iso.slice(0, 4)) >= new Date().getFullYear() - 1;
  return yearUnknown ? iso.slice(5) : iso;
}

function parseRole(raw: string | undefined): MemberRole | undefined {
  if (!raw) return undefined;
  return ROLE_VALUES.find((r) => r.toLowerCase() === raw.toLowerCase());
}

function parseEmail(raw: string | undefined): string | undefined {
  const v = raw?.replace(/^mailto:/i, "");
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : undefined;
}

// Excel stores phone numbers as numbers, which drops the leading 0
// (0821234567 → 821234567); a 27-prefixed one is missing its "+".
function parsePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^27\d{9}$/.test(digits)) return `+${digits}`;
  if (/^[1-9]\d{8}$/.test(digits)) return `0${digits}`;
  return raw;
}

export type ParseResult = {
  rows: ParsedMemberRow[];
  skipped: { row: number; reason: string }[];
  matchedHeaders: { field: Field; header: string }[];
  // Headers the importer doesn't recognise — left out, not an error.
  ignoredHeaders: string[];
};

export function parseMemberTable({ headers, rows: dataRows }: TableFile, mapping?: ColumnMapping): ParseResult {
  if (headers.length === 0) return { rows: [], skipped: [], matchedHeaders: [], ignoredHeaders: [] };

  const { builtin: headerMap, custom: customColumns } = resolveColumns(headers, mapping);
  const matchedHeaders = (Object.entries(headerMap) as [Field, number][]).map(([field, idx]) => ({
    field,
    header: headers[idx],
  }));
  const matchedIdx = new Set([...Object.values(headerMap), ...customColumns.map(([, i]) => i)]);
  const ignoredHeaders = headers.filter((h, i) => h.trim() && !matchedIdx.has(i));

  const rows: ParsedMemberRow[] = [];
  const skipped: { row: number; reason: string }[] = [];

  dataRows.forEach((cells, i) => {
    const get = (field: Field) => {
      const idx = headerMap[field];
      return idx === undefined ? undefined : clean(cells[idx]);
    };
    if (cells.every((c) => !c?.trim())) return; // fully blank row, silently skip

    let firstName = get("firstName");
    let lastName = get("lastName");
    // A single full-name column (or a "Name" column with no surname column
    // beside it): the last word is the surname.
    const full = get("fullName") ?? (headerMap.lastName === undefined ? firstName : undefined);
    if (full && !lastName) {
      const parts = full.split(" ");
      firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : full;
      lastName = parts.length > 1 ? parts[parts.length - 1] : undefined;
    }
    if (!firstName) {
      // Section dividers ("A", "B", …) and stray numbers aren't people — only
      // flag a nameless row if it has contact details someone may want.
      if (get("email") || get("phone")) skipped.push({ row: i + 2, reason: "No name" }); // +2: 1-indexed, plus header row
      return;
    }

    const custom: Record<string, string> = {};
    for (const [key, idx] of customColumns) {
      const v = clean(cells[idx]);
      if (v) custom[key] = v;
    }

    const givingRaw = get("givingTotal");
    const givingTotal = givingRaw ? Number(givingRaw) : undefined;

    rows.push({
      firstName,
      lastName: lastName ?? "",
      email: parseEmail(get("email")),
      phone: parsePhone(get("phone")),
      joinDate: parseDate(get("joinDate")),
      role: parseRole(get("role")),
      givingTotal: givingTotal && !Number.isNaN(givingTotal) ? givingTotal : undefined,
      givingDate: parseDate(get("givingDate")),
      title: get("title"),
      birthday: parseBirthday(get("birthday")),
      cellName: get("cellName"),
      ageGroup: ageGroupFor(get("ageGroup")),
      profession: get("profession"),
      spouseName: get("spouseName"),
      weddingAnniversary: parseBirthday(get("weddingAnniversary")),
      kcHandle: get("kcHandle"),
      guardianName: get("guardianName"),
      guardianPhone: parsePhone(get("guardianPhone")),
      ...(Object.keys(custom).length ? { custom } : {}),
    });
  });

  return { rows, skipped, matchedHeaders, ignoredHeaders };
}

// Workbooks that also keep one tab per age group ("Adults", "Teens", …)
// alongside the main list: each tab's people are matched to the main list by
// name (allowing for typos) and given that group. Someone only on a group tab
// is added from it. If the first sheet is itself a group tab, there's no
// main list and the group tabs together are the members.
export function mergeAgeGroupSheets(sheets: SheetTable[], mapping?: ColumnMapping): ParseResult {
  const mainSheet = sheets[0] && !ageGroupFor(sheets[0].sheetName) ? sheets[0] : undefined;
  const main = mainSheet ? parseMemberTable(mainSheet, mapping) : undefined;
  const rows = [...(main?.rows ?? [])];
  const byKey = new Map(rows.map((r) => [nameKey(r), r]));
  let firstTab: ParseResult | undefined;

  for (const tab of sheets) {
    const group = ageGroupFor(tab.sheetName);
    if (!group) continue;
    const parsed = parseMemberTable(tab, mapping);
    firstTab ??= parsed;
    for (const r of parsed.rows) {
      const exact = byKey.get(nameKey(r));
      // A tab often lists someone by first name only; namesAgree then
      // matches on that one name, so it only counts when it's unambiguous.
      const close = exact ? [exact] : rows.filter((m) => !m.ageGroup && namesAgree(m, r));
      if (close.length === 1) {
        close[0].ageGroup ??= group;
      } else {
        const added = { ...r, ageGroup: group };
        rows.push(added);
        byKey.set(nameKey(added), added);
      }
    }
  }

  const headersFrom = main ?? firstTab;
  return {
    rows,
    skipped: main?.skipped ?? [],
    matchedHeaders: headersFrom?.matchedHeaders ?? [],
    ignoredHeaders: headersFrom?.ignoredHeaders ?? [],
  };
}

// The sheets a member file is read from: every tab when it keeps one per
// age group (see mergeAgeGroupSheets), otherwise just the first.
export async function memberSheets(file: File): Promise<{ sheets: SheetTable[]; ageGroupTabs: boolean }> {
  if (!file.name.toLowerCase().endsWith(".csv") && tenant.ageGroups?.length) {
    const sheets = await readAllExcelSheets(file);
    if (sheets.some((s) => ageGroupFor(s.sheetName))) return { sheets, ageGroupTabs: true };
  }
  return { sheets: [{ ...(await readTableFile(file)), sheetName: "" }], ageGroupTabs: false };
}

export function parseMemberSheets({ sheets, ageGroupTabs }: { sheets: SheetTable[]; ageGroupTabs: boolean }, mapping?: ColumnMapping): ParseResult {
  return ageGroupTabs ? mergeAgeGroupSheets(sheets, mapping) : parseMemberTable(sheets[0] ?? { headers: [], rows: [] }, mapping);
}

export async function parseMemberSheet(file: File, mapping?: ColumnMapping): Promise<ParseResult> {
  return parseMemberSheets(await memberSheets(file), mapping);
}

import { buildHeaderMap, readTableFile } from "./read-table-file";
import { categoryFromText, GIVING_CATEGORIES, type GivingCategory } from "@/lib/giving";
import type { Church } from "@/lib/data/types";

// Just the member fields matching needs — the full Member (with its giving
// and training history) would bloat what gets shipped to the browser.
export type GivingMatchMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  churchId: string;
};

type Field =
  | "email"
  | "name"
  | "firstName"
  | "lastName"
  | "church"
  | "date"
  | "category"
  | "amount"
  | GivingCategory;

// A sheet can be "wide" (one column per category: PCO | Dues | Special
// Project | META) or "long" (a Category column plus an Amount column).
const HEADER_ALIASES: Record<Field, string[]> = {
  email: ["email", "email address"],
  name: ["name", "member", "member name", "full name"],
  firstName: ["first name", "firstname"],
  lastName: ["last name", "lastname", "surname"],
  church: ["church", "church name", "chapter", "chapter name"],
  date: ["date", "month", "period", "giving date"],
  category: ["category", "giving type", "type"],
  amount: ["amount", "total"],
  pco: ["pco"],
  dues: ["dues", "due"],
  special_project: ["special project", "special projects", "special"],
  meta: ["meta"],
};

export type ParsedGivingRow = {
  memberId: string;
  month: string; // "YYYY-MM"
  category: GivingCategory;
  amount: number;
};

export type GivingParseResult = {
  rows: ParsedGivingRow[];
  skipped: { row: number; reason: string }[];
  totalsByCategory: Record<GivingCategory, number>;
  memberCount: number;
};

function nameKey(name: string): string {
  // Order-insensitive so "Moyo Bongani" matches "Bongani Moyo".
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function parseAmount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? NaN : n;
}

function toMonth(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 7);
}

export async function parseGivingSheet(
  file: File,
  members: GivingMatchMember[],
  churches: Church[],
  defaultMonth: string
): Promise<GivingParseResult> {
  const totalsByCategory = Object.fromEntries(GIVING_CATEGORIES.map((c) => [c.id, 0])) as Record<GivingCategory, number>;
  const empty: GivingParseResult = { rows: [], skipped: [], totalsByCategory, memberCount: 0 };

  const { headers, rows: dataRows } = await readTableFile(file);
  if (headers.length === 0) return empty;

  const headerMap = buildHeaderMap(headers, HEADER_ALIASES);
  const wideCategories = GIVING_CATEGORIES.filter((c) => headerMap[c.id] !== undefined);
  const isLong = headerMap.category !== undefined && headerMap.amount !== undefined;
  const hasIdentity =
    headerMap.email !== undefined || headerMap.name !== undefined || (headerMap.firstName !== undefined && headerMap.lastName !== undefined);

  if (!hasIdentity) {
    return { ...empty, skipped: [{ row: 1, reason: "Need an Email column, a Name column, or First Name + Last Name columns" }] };
  }
  if (wideCategories.length === 0 && !isLong) {
    return {
      ...empty,
      skipped: [{ row: 1, reason: "Need PCO / Dues / Special Project / META columns, or a Category + Amount pair" }],
    };
  }

  const memberByEmail = new Map<string, GivingMatchMember>();
  const membersByName = new Map<string, GivingMatchMember[]>();
  for (const m of members) {
    if (m.email) memberByEmail.set(m.email.trim().toLowerCase(), m);
    const key = nameKey(`${m.firstName} ${m.lastName}`);
    membersByName.set(key, [...(membersByName.get(key) ?? []), m]);
  }
  const churchIdByName = new Map(churches.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const rows: ParsedGivingRow[] = [];
  const skipped: { row: number; reason: string }[] = [];
  const matchedMembers = new Set<string>();

  dataRows.forEach((cells, i) => {
    if (cells.every((c) => !c?.trim())) return;
    const rowNumber = i + 2;
    const get = (field: Field) => {
      const idx = headerMap[field];
      return idx === undefined ? undefined : cells[idx]?.trim();
    };

    // Who is this row about?
    let member: GivingMatchMember | undefined;
    const email = get("email")?.toLowerCase();
    if (email) member = memberByEmail.get(email);
    if (!member) {
      const fullName = get("name") ?? [get("firstName"), get("lastName")].filter(Boolean).join(" ");
      if (!fullName && !email) {
        skipped.push({ row: rowNumber, reason: "Missing member name or email" });
        return;
      }
      let candidates = membersByName.get(nameKey(fullName ?? "")) ?? [];
      const churchName = get("church");
      const churchId = churchName ? churchIdByName.get(churchName.toLowerCase()) : undefined;
      if (churchId && candidates.length > 1) candidates = candidates.filter((m) => m.churchId === churchId);
      if (candidates.length === 0) {
        skipped.push({ row: rowNumber, reason: `No member found for "${fullName || email}"` });
        return;
      }
      if (candidates.length > 1) {
        skipped.push({ row: rowNumber, reason: `"${fullName}" matches ${candidates.length} members — add an Email or Church column` });
        return;
      }
      member = candidates[0];
    }

    const dateRaw = get("date");
    const month = dateRaw ? toMonth(dateRaw) : defaultMonth;
    if (!month) {
      skipped.push({ row: rowNumber, reason: `Couldn't read the date "${dateRaw}"` });
      return;
    }

    // What did they give? One or more (category, amount) pairs.
    const gifts: { category: GivingCategory; amount: number }[] = [];
    let problem: string | undefined;
    if (wideCategories.length > 0) {
      for (const c of wideCategories) {
        const amount = parseAmount(get(c.id));
        if (amount === undefined || amount === 0) continue;
        if (Number.isNaN(amount) || amount < 0) problem = `Invalid ${c.label} amount`;
        else gifts.push({ category: c.id, amount });
      }
    } else {
      const categoryRaw = get("category");
      const category = categoryFromText(categoryRaw);
      const amount = parseAmount(get("amount"));
      if (!category) problem = `Unknown category "${categoryRaw ?? ""}" — use PCO, Dues, Special Project or META`;
      else if (amount === undefined || Number.isNaN(amount) || amount <= 0) problem = "Missing or invalid amount";
      else gifts.push({ category, amount });
    }
    if (problem) {
      skipped.push({ row: rowNumber, reason: problem });
      return;
    }
    if (gifts.length === 0) return; // a member with nothing given this period isn't an error

    for (const g of gifts) {
      rows.push({ memberId: member.id, month, category: g.category, amount: g.amount });
      totalsByCategory[g.category] += g.amount;
    }
    matchedMembers.add(member.id);
  });

  return { rows, skipped, totalsByCategory, memberCount: matchedMembers.size };
}

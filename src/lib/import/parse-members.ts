import type { MemberRole } from "@/lib/data/types";
import type { ParsedMemberRow } from "@/lib/actions/members";
import { buildHeaderMap, readTableFile } from "./read-table-file";

const ROLE_VALUES: MemberRole[] = ["Member", "Worker", "Cell Leader", "Pastor"];

// Header aliases, matched case-insensitively with whitespace collapsed —
// this is the "reads the file's own headers" auto-detection.
const HEADER_ALIASES: Partial<Record<keyof ParsedMemberRow, string[]>> = {
  firstName: ["first name", "firstname", "first"],
  lastName: ["last name", "lastname", "surname", "last"],
  email: ["email", "email address"],
  phone: ["phone", "phone number", "mobile", "cell"],
  joinDate: ["join date", "date joined", "joined"],
  role: ["role", "member role"],
  givingTotal: ["giving amount", "giving total", "total giving"],
  givingDate: ["giving date", "last giving date"],
};

function parseJoinDate(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function parseRole(raw: string | undefined): MemberRole | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const match = ROLE_VALUES.find((r) => r.toLowerCase() === trimmed.toLowerCase());
  return match;
}

export type ParseResult = {
  rows: ParsedMemberRow[];
  skipped: { row: number; reason: string }[];
  matchedHeaders: { field: keyof ParsedMemberRow; header: string }[];
};

export async function parseMemberSheet(file: File): Promise<ParseResult> {
  const { headers, rows: dataRows } = await readTableFile(file);
  if (headers.length === 0) return { rows: [], skipped: [], matchedHeaders: [] };

  const headerMap = buildHeaderMap(headers, HEADER_ALIASES);
  const matchedHeaders = (Object.entries(headerMap) as [keyof ParsedMemberRow, number][]).map(([field, idx]) => ({
    field,
    header: headers[idx],
  }));

  const rows: ParsedMemberRow[] = [];
  const skipped: { row: number; reason: string }[] = [];

  dataRows.forEach((cells, i) => {
    const get = (field: keyof ParsedMemberRow) => {
      const idx = headerMap[field];
      return idx === undefined ? undefined : cells[idx]?.trim();
    };
    const firstName = get("firstName");
    const lastName = get("lastName");
    if (!firstName || !lastName) {
      if (cells.every((c) => !c?.trim())) return; // fully blank row, silently skip
      skipped.push({ row: i + 2, reason: "Missing first or last name" }); // +2: 1-indexed, plus header row
      return;
    }
    const givingRaw = get("givingTotal");
    const givingTotal = givingRaw ? Number(givingRaw) : undefined;

    rows.push({
      firstName,
      lastName,
      email: get("email") || undefined,
      phone: get("phone") || undefined,
      joinDate: parseJoinDate(get("joinDate")),
      role: parseRole(get("role")),
      givingTotal: givingTotal && !Number.isNaN(givingTotal) ? givingTotal : undefined,
      givingDate: parseJoinDate(get("givingDate")),
    });
  });

  return { rows, skipped, matchedHeaders };
}

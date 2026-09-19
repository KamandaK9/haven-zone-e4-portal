import { buildHeaderMap, normalizeHeader, readTableFile } from "./read-table-file";
import type { WizardCountry } from "@/components/setup/types";
import type { ParsedMemberRow } from "@/lib/actions/members";
import type { MemberRole } from "@/lib/data/types";

const ROLE_VALUES: MemberRole[] = ["Member", "Worker", "Cell Leader", "Pastor"];

type Field = "country" | "church" | "firstName" | "lastName" | "email" | "phone" | "role" | "inactive";

const HEADER_ALIASES: Record<Field, string[]> = {
  country: ["country"],
  church: ["chapter name", "church", "church name", "chapter", "cell name"],
  firstName: ["first name", "firstname", "first"],
  lastName: ["last name", "lastname", "surname", "last"],
  email: ["email", "email address"],
  phone: ["phone", "phone number", "mobile", "cell phone"],
  role: ["role", "member role"],
  inactive: ["inactive yes no", "inactive"],
};

// Real exports name giving/date columns with the year baked in
// (TOTAL_2026_USD_GIVING_AMOUNT, LAST_2026_GIVING_DATE) — match by the
// stable substrings rather than an exact string.
function findHeaderBySubstrings(headers: string[], required: string[]): number | undefined {
  const idx = headers.findIndex((h) => {
    const n = normalizeHeader(h);
    return required.every((s) => n.includes(s));
  });
  return idx === -1 ? undefined : idx;
}

export type ZoneImportRow = {
  countryName: string;
  churchName: string;
  member: ParsedMemberRow;
};

export type ZoneImportResult = {
  countries: WizardCountry[];
  rows: ZoneImportRow[];
  skipped: { row: number; reason: string }[];
  matchedHeaders: { field: string; header: string }[];
  totalRows: number;
  totalGiving: number;
};

export async function parseZoneMemberSheet(file: File): Promise<ZoneImportResult> {
  const { headers, rows: dataRows } = await readTableFile(file);
  if (headers.length === 0) {
    return { countries: [], rows: [], skipped: [], matchedHeaders: [], totalRows: 0, totalGiving: 0 };
  }

  const headerMap = buildHeaderMap(headers, HEADER_ALIASES);
  const givingIdx = findHeaderBySubstrings(headers, ["giving", "amount"]);
  const givingDateIdx = findHeaderBySubstrings(headers, ["giving", "date"]);

  const matchedHeaders: { field: string; header: string }[] = [
    ...(Object.entries(headerMap) as [Field, number][]).map(([field, idx]) => ({ field, header: headers[idx] })),
    ...(givingIdx !== undefined ? [{ field: "givingTotal", header: headers[givingIdx] }] : []),
    ...(givingDateIdx !== undefined ? [{ field: "givingDate", header: headers[givingDateIdx] }] : []),
  ];

  if (headerMap.country === undefined || headerMap.church === undefined) {
    return {
      countries: [],
      rows: [],
      skipped: [{ row: 1, reason: 'Need both a "Country" and a "Church"/"Chapter" column' }],
      matchedHeaders,
      totalRows: 0,
      totalGiving: 0,
    };
  }

  const order: string[] = [];
  const byCountry = new Map<string, Set<string>>();
  const rows: ZoneImportRow[] = [];
  const skipped: { row: number; reason: string }[] = [];
  let totalGiving = 0;

  dataRows.forEach((cells, i) => {
    if (cells.every((c) => !c?.trim())) return; // blank row

    const get = (field: Field) => {
      const idx = headerMap[field];
      return idx === undefined ? undefined : cells[idx]?.trim();
    };

    const countryRaw = get("country");
    const churchRaw = get("church");
    const firstName = get("firstName");
    const lastName = get("lastName");

    if (!countryRaw || !churchRaw) {
      skipped.push({ row: i + 2, reason: "Missing country or church" });
      return;
    }
    if (!firstName || !lastName) {
      skipped.push({ row: i + 2, reason: "Missing first or last name" });
      return;
    }

    // Title-case the all-caps country names real exports tend to use.
    const countryName = countryRaw.length > 3 && countryRaw === countryRaw.toUpperCase()
      ? countryRaw.replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase())
      : countryRaw;

    if (!byCountry.has(countryName)) {
      byCountry.set(countryName, new Set());
      order.push(countryName);
    }
    byCountry.get(countryName)!.add(churchRaw);

    const roleRaw = get("role");
    const role = roleRaw ? ROLE_VALUES.find((r) => r.toLowerCase() === roleRaw.toLowerCase()) : undefined;
    const inactive = get("inactive")?.toLowerCase() === "yes";

    const givingRaw = givingIdx !== undefined ? cells[givingIdx]?.trim() : undefined;
    const givingTotal = givingRaw ? Number(givingRaw) : undefined;
    const givingDate = givingDateIdx !== undefined ? cells[givingDateIdx]?.trim() : undefined;

    if (givingTotal && !Number.isNaN(givingTotal)) totalGiving += givingTotal;

    if (inactive) return; // skip inactive members entirely rather than importing dead weight

    rows.push({
      countryName,
      churchName: churchRaw,
      member: {
        firstName,
        lastName,
        email: get("email") || undefined,
        phone: get("phone") || undefined,
        role,
        givingTotal: givingTotal && !Number.isNaN(givingTotal) ? givingTotal : undefined,
        givingDate: givingDate && !Number.isNaN(Date.parse(givingDate)) ? givingDate : undefined,
      },
    });
  });

  const countries: WizardCountry[] = order.map((name) => ({ name, churches: [...byCountry.get(name)!] }));

  return { countries, rows, skipped, matchedHeaders, totalRows: rows.length, totalGiving };
}

import { buildHeaderMap, readTableFile } from "./read-table-file";
import type { WizardCountry } from "@/components/setup/types";

type Field = "country" | "church";

const HEADER_ALIASES: Record<Field, string[]> = {
  country: ["country", "country name", "nation"],
  church: ["church", "church name"],
};

export type StructureParseResult = {
  countries: WizardCountry[];
  skipped: { row: number; reason: string }[];
  matchedHeaders: { field: Field; header: string }[];
};

// One row per church: a "Country" column and a "Church" column. Rows are
// grouped by country in first-seen order, so a country with no churches at
// all can still appear if it has a row with an empty Church cell.
export async function parseStructureSheet(file: File): Promise<StructureParseResult> {
  const { headers, rows: dataRows } = await readTableFile(file);
  if (headers.length === 0) return { countries: [], skipped: [], matchedHeaders: [] };

  const headerMap = buildHeaderMap(headers, HEADER_ALIASES);
  const matchedHeaders = (Object.entries(headerMap) as [Field, number][]).map(([field, idx]) => ({
    field,
    header: headers[idx],
  }));

  if (headerMap.country === undefined) {
    return { countries: [], skipped: [{ row: 1, reason: 'No "Country" column found' }], matchedHeaders };
  }

  const order: string[] = [];
  const byCountry = new Map<string, Set<string>>();
  const skipped: { row: number; reason: string }[] = [];

  dataRows.forEach((cells, i) => {
    if (cells.every((c) => !c?.trim())) return; // blank row
    const country = cells[headerMap.country!]?.trim();
    const church = headerMap.church !== undefined ? cells[headerMap.church]?.trim() : "";

    if (!country) {
      skipped.push({ row: i + 2, reason: "Missing country" });
      return;
    }
    if (!byCountry.has(country)) {
      byCountry.set(country, new Set());
      order.push(country);
    }
    if (church) byCountry.get(country)!.add(church);
  });

  const countries: WizardCountry[] = order.map((name) => {
    const churches = [...byCountry.get(name)!];
    return { name, churches: churches.length > 0 ? churches : [""] };
  });

  return { countries, skipped, matchedHeaders };
}

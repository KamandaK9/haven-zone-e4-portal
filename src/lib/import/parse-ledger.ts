import { buildHeaderMap, readTableFile } from "./read-table-file";
import type { Church, LedgerEntryType } from "@/lib/data/types";

type Field = "church" | "type" | "category" | "description" | "amount" | "date";

const HEADER_ALIASES: Record<Field, string[]> = {
  church: ["church", "church name", "chapter", "chapter name"],
  type: ["type", "income expense"],
  category: ["category"],
  description: ["description", "notes", "note"],
  amount: ["amount"],
  date: ["date", "entry date"],
};

export type ParsedLedgerRow = {
  churchId: string;
  type: LedgerEntryType;
  category: string;
  description?: string;
  amount: number;
  entryDate: string;
};

export type LedgerParseResult = {
  rows: ParsedLedgerRow[];
  skipped: { row: number; reason: string }[];
  matchedHeaders: { field: Field; header: string }[];
};

export async function parseLedgerSheet(file: File, churches: Church[]): Promise<LedgerParseResult> {
  const { headers, rows: dataRows } = await readTableFile(file);
  if (headers.length === 0) return { rows: [], skipped: [], matchedHeaders: [] };

  const headerMap = buildHeaderMap(headers, HEADER_ALIASES);
  const matchedHeaders = (Object.entries(headerMap) as [Field, number][]).map(([field, idx]) => ({
    field,
    header: headers[idx],
  }));

  const churchByName = new Map(churches.map((c) => [c.name.trim().toLowerCase(), c.id]));

  const rows: ParsedLedgerRow[] = [];
  const skipped: { row: number; reason: string }[] = [];

  dataRows.forEach((cells, i) => {
    if (cells.every((c) => !c?.trim())) return;

    const get = (field: Field) => {
      const idx = headerMap[field];
      return idx === undefined ? undefined : cells[idx]?.trim();
    };

    const churchName = get("church");
    const churchId = churchName ? churchByName.get(churchName.toLowerCase()) : undefined;
    if (!churchName || !churchId) {
      skipped.push({ row: i + 2, reason: churchName ? `Unknown church "${churchName}"` : "Missing church" });
      return;
    }

    const typeRaw = get("type")?.toLowerCase();
    const type: LedgerEntryType | undefined =
      typeRaw === "income" || typeRaw === "expense" ? typeRaw : typeRaw?.includes("expense") ? "expense" : typeRaw?.includes("income") ? "income" : undefined;
    if (!type) {
      skipped.push({ row: i + 2, reason: 'Type must be "income" or "expense"' });
      return;
    }

    const category = get("category");
    if (!category) {
      skipped.push({ row: i + 2, reason: "Missing category" });
      return;
    }

    const amountRaw = get("amount");
    const amount = amountRaw ? Number(amountRaw) : NaN;
    if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
      skipped.push({ row: i + 2, reason: "Missing or invalid amount" });
      return;
    }

    const dateRaw = get("date");
    const entryDate = dateRaw && !Number.isNaN(Date.parse(dateRaw)) ? new Date(dateRaw).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

    rows.push({ churchId, type, category, description: get("description"), amount, entryDate });
  });

  return { rows, skipped, matchedHeaders };
}

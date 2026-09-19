import type { CellValue } from "exceljs";

export type TableFile = { headers: string[]; rows: string[][] };

async function readCsv(file: File): Promise<TableFile> {
  const Papa = (await import("papaparse")).default;
  const text = await file.text();
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const [headers, ...rows] = result.data;
  return { headers: headers ?? [], rows };
}

async function readExcel(file: File): Promise<TableFile> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const toStringRow = (values: CellValue[] | { [key: string]: CellValue }): string[] => {
    const arr = Array.isArray(values) ? values : Object.values(values);
    // ExcelJS row.values is 1-indexed with a leading empty slot — drop it.
    return arr.slice(1).map((v) => {
      if (v == null) return "";
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v);
    });
  };

  const headers = toStringRow(sheet.getRow(1).values);
  const rows: string[][] = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    rows.push(toStringRow(sheet.getRow(i).values));
  }
  return { headers, rows };
}

export async function readTableFile(file: File): Promise<TableFile> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return readCsv(file);
  return readExcel(file);
}

export type SheetTable = TableFile & { sheetName: string };

// For workbooks that spread data across multiple sheets (e.g. one tab per
// sub-zone) rather than a single flat table.
export async function readAllExcelSheets(file: File): Promise<SheetTable[]> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const toStringRow = (values: CellValue[] | { [key: string]: CellValue }): string[] => {
    const arr = Array.isArray(values) ? values : Object.values(values);
    return arr.slice(1).map((v) => {
      if (v == null) return "";
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      return String(v);
    });
  };

  return workbook.worksheets.map((sheet) => {
    const headers = toStringRow(sheet.getRow(1).values);
    const rows: string[][] = [];
    for (let i = 2; i <= sheet.rowCount; i++) {
      rows.push(toStringRow(sheet.getRow(i).values));
    }
    return { sheetName: sheet.name, headers, rows };
  });
}

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

export function buildHeaderMap<TField extends string>(
  headers: string[],
  aliases: Partial<Record<TField, string[]>>
): Partial<Record<TField, number>> {
  const map: Partial<Record<TField, number>> = {};
  headers.forEach((raw, index) => {
    const normalized = normalizeHeader(raw);
    for (const [field, fieldAliases] of Object.entries(aliases) as [TField, string[]][]) {
      if (field in map) continue;
      if (fieldAliases.includes(normalized)) map[field] = index;
    }
  });
  return map;
}

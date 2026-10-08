import { tenant } from "@/tenant";
import type { MemberField } from "@/lib/custom-fields";

// A ready-made member sheet an organisation can fill in, for when they don't
// already keep one. Nobody has to use it — the importer reads sheets as they
// are — but every column here is one the importer recognises. The
// organisation's own member fields are added as columns too.
export async function buildMemberTemplate(fields: MemberField[] = []): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const groups = tenant.ageGroups ?? [];
  const cell = tenant.labels.cell;

  const columns = [
    { header: "Title", key: "title", width: 12 },
    { header: "First name", key: "first", width: 18 },
    { header: "Surname", key: "last", width: 18 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Email", key: "email", width: 28 },
    { header: "Birthday", key: "birthday", width: 14 },
    { header: cell, key: "cell", width: 20 },
    ...(groups.length > 0 ? [{ header: "Age group", key: "ageGroup", width: 14 }] : []),
  ];
  const own = fields.filter((f) => !f.archived);
  for (const f of own) columns.push({ header: f.label, key: `custom:${f.key}`, width: Math.max(14, f.label.length + 4) });

  const members = workbook.addWorksheet("Members");
  members.columns = columns;
  members.getRow(1).font = { bold: true };
  members.views = [{ state: "frozen", ySplit: 1 }];
  if (groups.length > 0) {
    const col = columns.findIndex((c) => c.key === "ageGroup") + 1;
    const list = `"${groups.map((g) => g.label).join(",")}"`;
    for (let row = 2; row <= 1000; row++) {
      members.getCell(row, col).dataValidation = { type: "list", allowBlank: true, formulae: [list] };
    }
  }
  for (const f of own) {
    const choices = f.type === "yes_no" ? ["Yes", "No"] : f.type === "select" ? f.options : [];
    // Excel caps a typed-in list at 255 characters.
    const list = `"${choices.map((c) => c.replace(/[",]/g, " ")).join(",")}"`;
    if (choices.length === 0 || list.length > 255) continue;
    const col = columns.findIndex((c) => c.key === `custom:${f.key}`) + 1;
    for (let row = 2; row <= 1000; row++) {
      members.getCell(row, col).dataValidation = { type: "list", allowBlank: true, formulae: [list] };
    }
  }

  const help = workbook.addWorksheet("How to fill this in");
  help.getColumn(1).width = 100;
  const lines = [
    "How to fill in this sheet",
    "",
    "• One person per row on the Members tab, starting on row 2.",
    "• Only First name is required — leave anything you don't know blank.",
    "• You can add your own extra columns; the import simply ignores ones it doesn't use.",
    "• Phone: any format (082 123 4567, +27 82 123 4567).",
    "• Children: add \"Guardian name\" and \"Guardian phone\" columns — messages to under-18s go to their guardian, never to them.",
    "• Birthday: a full date, or just a day and month (12 April) if you don't know the year.",
    `• ${cell}: the name of the person's ${cell.toLowerCase()}. Small spelling differences are fine — you'll confirm the list of ${tenant.labels.cellPlural.toLowerCase()} when you import.`,
    ...(groups.length > 0
      ? [
          `• Age group: one of ${groups.map((g) => g.label).join(", ")}.`,
          "  Already keep a separate tab per age group (e.g. an \"Adults\" tab)? That works too — keep your tabs and leave this column out.",
        ]
      : []),
    ...own.map((f) => `• ${f.label}: ${f.type === "date" ? "a date" : f.type === "number" ? "a number" : f.type === "yes_no" ? "Yes or No" : f.type === "select" ? `one of ${f.options.join(", ")}` : "any text"}.`),
    "",
    "Already have your own member spreadsheet? You don't need this template — import that file as it is.",
  ];
  lines.forEach((text, i) => {
    const row = help.getRow(i + 1);
    row.getCell(1).value = text;
    if (i === 0) row.font = { bold: true, size: 14 };
  });

  // The example lives here rather than on the Members tab, so it can never be
  // imported as a real person.
  const exampleAt = lines.length + 2;
  help.getRow(exampleAt).getCell(1).value = "Example";
  help.getRow(exampleAt).font = { bold: true };
  const example = ["Sister", "Jane", "Doe", "082 123 4567", "jane@example.com", "12 April", `Example ${cell}`, groups.at(-1)?.label];
  columns.forEach((c, i) => {
    help.getRow(exampleAt + 1).getCell(i + 1).value = c.header;
    help.getRow(exampleAt + 2).getCell(i + 1).value = example[i] ?? "";
  });
  help.getRow(exampleAt + 1).font = { bold: true };

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function downloadMemberTemplate(fields: MemberField[] = []) {
  const buffer = await buildMemberTemplate(fields);
  const url = URL.createObjectURL(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${tenant.name} member template.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

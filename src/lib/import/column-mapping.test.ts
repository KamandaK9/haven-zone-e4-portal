import { describe, expect, it, vi } from "vitest";
import { importColumns, mappingProblem, suggestMapping } from "./column-mapping";
import { parseMemberTable } from "./parse-members";

vi.mock("@/tenant", async (importOriginal) => {
  const { tenant } = await importOriginal<typeof import("@/tenant")>();
  return { tenant: { ...tenant, ageGroups: [] } };
});

const sheet = {
  sheetName: "",
  headers: ["Names", "Surname", "Cell No", "Baptised?", "Department", "Notes"],
  rows: [
    ["Jane", "Doe", "0821234567", "Yes", "Choir", ""],
    ["John", "Smith", "0831234567", "no", "Ushers", "New"],
  ],
};
const fields = [{ key: "department", label: "Department", archived: false }];

describe("importColumns", () => {
  it("lists each column with sample values", () => {
    const cols = importColumns([sheet]);
    expect(cols.map((c) => c.key)).toEqual(["names", "surname", "cell no", "baptised?", "department", "notes"]);
    expect(cols[3].samples).toEqual(["Yes", "no"]);
    expect(cols[5].samples).toEqual(["New"]);
  });
});

describe("suggestMapping", () => {
  it("prefers the saved template, then known names, then a field with the same label", () => {
    const m = suggestMapping(importColumns([sheet]), {
      template: { names: "builtin:firstName", "cell no": "builtin:phone" },
      fields,
    });
    expect(m).toMatchObject({
      names: "builtin:firstName",
      surname: "builtin:lastName",
      "cell no": "builtin:phone",
      department: "custom:department",
      "baptised?": "skip",
      notes: "skip",
    });
  });

  it("ignores a template target whose field was archived", () => {
    const m = suggestMapping(importColumns([sheet]), {
      template: { notes: "custom:old_notes" },
      fields: [{ key: "old_notes", label: "Old", archived: true }],
    });
    expect(m.notes).toBe("skip");
  });
});

describe("mappingProblem", () => {
  it("needs a name column and no duplicate built-ins", () => {
    expect(mappingProblem({ a: "builtin:phone" })).toMatch(/names/);
    expect(mappingProblem({ a: "builtin:firstName", b: "builtin:phone", c: "builtin:phone" })).toMatch(/same detail/);
    expect(mappingProblem({ a: "builtin:fullName" })).toBeNull();
  });
});

describe("parseMemberTable with a mapping", () => {
  it("fills built-in details and custom fields from the chosen columns", () => {
    const r = parseMemberTable(sheet, {
      names: "builtin:firstName",
      surname: "builtin:lastName",
      "cell no": "builtin:phone",
      "baptised?": "custom:baptised",
      department: "custom:department",
      notes: "skip",
    });
    expect(r.rows[0]).toMatchObject({ firstName: "Jane", lastName: "Doe", phone: "0821234567", custom: { baptised: "Yes", department: "Choir" } });
    expect(r.rows[1].custom).toEqual({ baptised: "no", department: "Ushers" });
    expect(r.ignoredHeaders).toEqual(["Notes"]);
  });
});

import { expect, it } from "vitest";
import { buildMemberTemplate } from "./member-template";
import { memberSheets, parseMemberSheet } from "./parse-members";
import { importColumns, suggestMapping } from "./column-mapping";
import type { MemberField } from "@/lib/custom-fields";
import { tenant } from "@/tenant";

it("the template's columns are all ones the importer reads", async () => {
  const file = new File([await buildMemberTemplate()], "template.xlsx");
  const result = await parseMemberSheet(file);
  expect(result.rows).toEqual([]); // nothing to import until it's filled in
  expect(result.ignoredHeaders).toEqual([]);
  expect(result.matchedHeaders.map((m) => m.field).sort()).toEqual(
    ["title", "firstName", "lastName", "phone", "email", "birthday", "cellName", ...(tenant.ageGroups?.length ? ["ageGroup"] : [])].sort()
  );
});

it("adds the organisation's own fields as columns, matched back to them on import", async () => {
  const fields: MemberField[] = [
    { id: "f1", key: "department", label: "Department", type: "select", options: ["Choir", "Ushers"], visibility: "leaders", memberAccess: "hidden", sortOrder: 1, archived: false },
    { id: "f2", key: "old_field", label: "Old field", type: "text", options: [], visibility: "leaders", memberAccess: "hidden", sortOrder: 2, archived: true },
  ];
  const file = new File([await buildMemberTemplate(fields)], "template.xlsx");
  const columns = importColumns((await memberSheets(file)).sheets);
  expect(columns.map((c) => c.header)).toContain("Department");
  expect(columns.map((c) => c.header)).not.toContain("Old field");
  const mapping = suggestMapping(columns, { template: null, fields });
  expect(mapping[columns.find((c) => c.header === "Department")!.key]).toBe("custom:department");
});

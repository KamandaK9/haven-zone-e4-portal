import { expect, it } from "vitest";
import { buildMemberTemplate } from "./member-template";
import { parseMemberSheet } from "./parse-members";
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

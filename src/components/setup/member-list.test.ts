import { describe, expect, it } from "vitest";
import { cellMapFor, draftMemberField, memberListFrom, resolveMemberList, type MemberList } from "./member-list";
import { importColumns } from "@/lib/import/column-mapping";
import type { WizardState } from "./types";

const list: MemberList = {
  fileName: "members.xlsx",
  sheets: { sheets: [], ageGroupTabs: false },
  columns: [],
  mapping: {},
  members: [
    { firstName: "A", lastName: "One", cellName: "Kings&Pearls" },
    { firstName: "B", lastName: "Two", cellName: "KINGS PREAL" },
    { firstName: "C", lastName: "Three", cellName: "Youth Church" },
  ],
  skipped: 0,
  ignored: [],
  ageGroups: {},
  clusters: [
    { name: "Kings & Pearls", variants: ["Kings & Pearls", "Kings&Pearls"], count: 1, likelyCell: true },
    { name: "KINGS PREAL", variants: ["KINGS PREAL"], count: 1, likelyCell: true },
    { name: "Youth Church", variants: ["Youth Church"], count: 1, likelyCell: false },
  ],
  choices: {
    "Kings & Pearls": { action: "create", name: "Kings and Pearls" },
    "KINGS PREAL": { action: "merge", name: "KINGS PREAL", into: "Kings & Pearls" },
    "Youth Church": { action: "none", name: "Youth Church" },
  },
};

const wizard = (countries: WizardState["countries"], target?: string) =>
  ({ countries, importedMembers: [], memberList: { ...list, target } }) as unknown as WizardState;

describe("member list in setup", () => {
  it("maps every spelling through renames and merges", () => {
    expect(cellMapFor(list)).toEqual({
      "Kings & Pearls": "Kings and Pearls",
      "Kings&Pearls": "Kings and Pearls",
      "KINGS PREAL": "Kings and Pearls",
      "Youth Church": null,
    });
  });

  it("places members in the chosen church, as it's named at submit time", () => {
    const w = wizard([{ name: "Testland", churches: ["Grace Main", "Grace North"] }], "Testland::Grace North");
    expect(resolveMemberList(w).importedMembers.map((r) => r.churchName)).toEqual(["Grace North", "Grace North", "Grace North"]);
    // The chosen church was renamed afterwards: fall back to the first church rather than lose anyone.
    const renamed = wizard([{ name: "Testland", churches: ["Grace Central"] }], "Testland::Grace Main");
    expect(resolveMemberList(renamed).importedMembers.map((r) => r.churchName)).toEqual(["Grace Central", "Grace Central", "Grace Central"]);
  });

  it("doesn't loop on a merge cycle", () => {
    const cyclic = { ...list, choices: { ...list.choices, "Kings & Pearls": { action: "merge" as const, name: "x", into: "KINGS PREAL" } } };
    expect(cellMapFor(cyclic)["Kings&Pearls"]).toBeNull();
  });
});

describe("matching a member list's columns in setup", () => {
  const sheets = {
    ageGroupTabs: false,
    sheets: [
      {
        sheetName: "Sheet1",
        headers: ["Naam", "Van", "Department", "Notes"],
        rows: [
          ["Jane", "Doe", "Choir", "x"],
          ["John", "Roe", "Ushers", "y"],
        ],
      },
    ],
  };

  it("re-reads the members with the chosen columns, keeping cell decisions and church", () => {
    const columns = importColumns(sheets.sheets);
    const key = (h: string) => columns.find((c) => c.header === h)!.key;
    const none = memberListFrom("m.xlsx", sheets, columns, {});
    expect(none.members).toEqual([]); // no name column chosen yet

    const field = draftMemberField({ label: "Department", type: "select", options: ["Choir", "Ushers"], visibility: "leaders", memberAccess: "hidden" }, []);
    expect(field.ok).toBe(true);
    const mapping = { [key("Naam")]: "builtin:firstName", [key("Van")]: "builtin:lastName", [key("Department")]: "custom:department" };
    const matched = memberListFrom("m.xlsx", sheets, columns, mapping, { ...none, target: "SA::Main" });
    expect(matched.members.map((m) => [m.firstName, m.lastName, m.custom?.department])).toEqual([
      ["Jane", "Doe", "Choir"],
      ["John", "Roe", "Ushers"],
    ]);
    expect(matched.ignored).toEqual(["Notes"]);
    expect(matched.target).toBe("SA::Main");
  });

  it("checks draft fields like saved ones", () => {
    const first = draftMemberField({ label: "Department", type: "text", options: [], visibility: "leaders", memberAccess: "hidden" }, []);
    if (!first.ok) throw new Error(first.error);
    expect(first.field).toMatchObject({ id: "draft:department", key: "department" });
    expect(draftMemberField({ label: "department", type: "text", options: [], visibility: "leaders", memberAccess: "hidden" }, [first.field]).ok).toBe(false);
    expect(draftMemberField({ label: "Size", type: "select", options: ["M"], visibility: "leaders", memberAccess: "hidden" }, []).ok).toBe(false);
  });
});

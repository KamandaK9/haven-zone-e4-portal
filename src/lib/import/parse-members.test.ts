import { describe, expect, it } from "vitest";
import { mergeAgeGroupSheets, parseMemberTable } from "./parse-members";

// Mirrors a real church member sheet: Name/Surname, a "Cell" column that
// is the cell group, numeric phone numbers, and columns the importer ignores.
const churchSheetHeaders = ["S/N", "TITLE", "Name", "Surname", "PHONE NUMBER", "EMAIL", "BIRTHDAY", "CELL", "Home Address", ""];

describe("parseMemberTable", () => {
  it("reads a Name/Surname sheet with a cell-group column", () => {
    const result = parseMemberTable({
      headers: churchSheetHeaders,
      rows: [["1", "Sister", "Jane", " Doe", "27821234567", "jane@example.com", "1990-04-12", "Grace Cell", "1 Main Rd", ""]],
    });
    expect(result.skipped).toEqual([]);
    expect(result.rows).toEqual([
      expect.objectContaining({
        firstName: "Jane",
        lastName: "Doe",
        title: "Sister",
        phone: "+27821234567",
        email: "jane@example.com",
        birthday: "1990-04-12",
        cellName: "Grace Cell",
      }),
    ]);
    expect(result.rows[0].phone).not.toBe("Grace Cell");
    expect(result.ignoredHeaders).toEqual(["S/N", "Home Address"]);
  });

  it("continues when columns are missing", () => {
    const result = parseMemberTable({ headers: ["Name"], rows: [["Thabo"], ["Lerato Mokoena"]] });
    expect(result.skipped).toEqual([]);
    expect(result.rows.map((r) => [r.firstName, r.lastName])).toEqual([
      ["Thabo", ""],
      ["Lerato", "Mokoena"],
    ]);
    expect(result.rows[0].email).toBeUndefined();
  });

  it("drops placeholder emails and restores a phone's leading zero", () => {
    const result = parseMemberTable({
      headers: ["Name", "Surname", "Email address", "Phone"],
      rows: [["Sipho", "Ndlovu", "N/A", "821234567"]],
    });
    expect(result.rows[0].email).toBeUndefined();
    expect(result.rows[0].phone).toBe("0821234567");
  });

  it("ignores blank rows and A–Z dividers, but flags a nameless row with contact details", () => {
    const result = parseMemberTable({
      headers: ["S/N", "Name", "Surname", "Phone"],
      rows: [["", "", "", ""], ["", "", "B", ""], ["27", "", "", ""], ["", "", "", "0821234567"]],
    });
    expect(result.rows).toEqual([]);
    expect(result.skipped).toEqual([{ row: 5, reason: "No name" }]);
  });

  it("keeps only day and month when the birthday's year is really the typing year", () => {
    const thisYear = new Date().getFullYear();
    const result = parseMemberTable({
      headers: ["Name", "Birthday"],
      rows: [["Ama", `${thisYear}-04-12`], ["Kofi", "1990-04-12"], ["Esi", "12 April"]],
    });
    expect(result.rows.map((r) => r.birthday)).toEqual(["04-12", "1990-04-12", "04-12"]);
  });
});

describe("mergeAgeGroupSheets", () => {
  const headers = ["Name", "Surname"];
  const sheet = (sheetName: string, rows: string[][]) => ({ sheetName, headers, rows });

  it("gives main-list members the group of the tab they're on, allowing for typos", () => {
    const result = mergeAgeGroupSheets([
      sheet("Main Database", [["Blessing", "Moyo"], ["Tendai", "Manyeza"], ["Unsorted", "Person"]]),
      sheet("Adults", [["Blessing", "Moyo"]]),
      sheet("Teens", [["Tendayi", "Manyeza"]]),
    ]);
    expect(result.rows.map((r) => [r.firstName, r.ageGroup])).toEqual([
      ["Blessing", "adults"],
      ["Tendai", "teens"],
      ["Unsorted", undefined],
    ]);
  });

  it("adds someone who is only on a group tab", () => {
    const result = mergeAgeGroupSheets([sheet("Main Database", [["Blessing", "Moyo"]]), sheet("Children", [["Ruva", "Chikomo"]])]);
    expect(result.rows.map((r) => [r.firstName, r.ageGroup])).toEqual([
      ["Blessing", undefined],
      ["Ruva", "children"],
    ]);
  });

  it("matches a first-name-only tab entry only when it's unambiguous", () => {
    const result = mergeAgeGroupSheets([
      sheet("Main Database", [["Nyasha", "Dube"], ["Farai", "Dube"], ["Farai", "Sibanda"]]),
      sheet("Youth", [["Nyasha", ""], ["Farai", ""]]),
    ]);
    expect(result.rows.map((r) => r.ageGroup)).toEqual(["youth", undefined, undefined, "youth"]);
  });
});

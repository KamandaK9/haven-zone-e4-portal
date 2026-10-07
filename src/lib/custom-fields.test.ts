import { describe, expect, it } from "vitest";
import { distinctOptions, fieldKeyFrom, guessFieldType, leaderFieldAccess, normaliseFieldValue } from "./custom-fields";

describe("fieldKeyFrom", () => {
  it("makes a stable key, unique among existing ones", () => {
    expect(fieldKeyFrom("Baptism date", [])).toBe("baptism_date");
    expect(fieldKeyFrom("Baptism date", ["baptism_date"])).toBe("baptism_date_2");
    expect(fieldKeyFrom("2nd language", [])).toBe("f_2nd_language");
    expect(fieldKeyFrom("!!!", [])).toBe("field");
  });
});

describe("normaliseFieldValue", () => {
  const f = (type: "text" | "number" | "date" | "select" | "yes_no", options: string[] = []) => ({ label: "X", type, options });
  it("treats blank as no value", () => {
    expect(normaliseFieldValue(f("text"), "  ")).toEqual({ ok: true, value: null });
  });
  it("reads yes/no in the ways people type it", () => {
    expect(normaliseFieldValue(f("yes_no"), "Y")).toEqual({ ok: true, value: "yes" });
    expect(normaliseFieldValue(f("yes_no"), "false")).toEqual({ ok: true, value: "no" });
    expect(normaliseFieldValue(f("yes_no"), "maybe").ok).toBe(false);
  });
  it("matches a choice case-insensitively and keeps the option's spelling", () => {
    expect(normaliseFieldValue(f("select", ["Choir", "Ushers"]), "choir")).toEqual({ ok: true, value: "Choir" });
    expect(normaliseFieldValue(f("select", ["Choir"]), "Media").ok).toBe(false);
  });
  it("stores numbers and dates in a standard form", () => {
    expect(normaliseFieldValue(f("number"), "1 200")).toEqual({ ok: true, value: "1200" });
    expect(normaliseFieldValue(f("date"), "2026-03-01")).toEqual({ ok: true, value: "2026-03-01" });
    expect(normaliseFieldValue(f("date"), "not a date").ok).toBe(false);
  });
});

describe("guessFieldType", () => {
  it("guesses from sample values", () => {
    expect(guessFieldType(["Yes", "no", "Y"])).toBe("yes_no");
    expect(guessFieldType(["2026-01-02", "2025-12-01"])).toBe("date");
    expect(guessFieldType(["12", "1,500"])).toBe("number");
    expect(guessFieldType(["Choir", "Ushers", "Choir", "Ushers", "Choir"])).toBe("select");
    expect(guessFieldType(["Lives near the church"])).toBe("text");
  });
  it("collects distinct options", () => {
    expect(distinctOptions(["Choir", "choir ", "Ushers"])).toEqual(["Choir", "Ushers"]);
  });
});

describe("leaderFieldAccess", () => {
  const caps = (...have: string[]) => (c: string) => have.includes(c);
  it("follows each field's visibility", () => {
    expect(leaderFieldAccess({ visibility: "leaders" }, caps("view_members"))).toEqual({ see: true, edit: false });
    expect(leaderFieldAccess({ visibility: "leaders" }, caps("view_members", "manage_members"))).toEqual({ see: true, edit: true });
    expect(leaderFieldAccess({ visibility: "contact" }, caps("view_members", "manage_members"))).toEqual({ see: false, edit: false });
    expect(leaderFieldAccess({ visibility: "admins" }, caps("view_members", "manage_members", "view_contact_details"))).toEqual({ see: false, edit: false });
    expect(leaderFieldAccess({ visibility: "admins" }, caps("manage_settings"))).toEqual({ see: true, edit: true });
  });
});

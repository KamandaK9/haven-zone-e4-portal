import { describe, expect, it } from "vitest";
import { accountKeyFrom, applyOrgOverrides, defaultOrgSettings, validateOrgSettings } from "./org-settings";

describe("organisation settings", () => {
  const defaults = defaultOrgSettings();

  it("are the tenant's defaults until something is saved", () => {
    expect(applyOrgOverrides(defaults, null)).toEqual(defaults);
    expect(applyOrgOverrides(defaults, "nonsense")).toEqual(defaults);
  });

  it("take saved values over the defaults, ignoring anything malformed", () => {
    const s = applyOrgOverrides(defaults, {
      login: { headline: "  Welcome home  ", blurb: 42 },
      bankAccounts: [{ key: "building", label: "Building Fund" }, { key: "Bad Key", label: "x" }, { key: "empty", label: "" }],
      meetingTypes: ["Board", "Board", " ", "AGM"],
      attendance: { activeMinSundays: 3, absenceAlertAfter: 99 },
    });
    expect(s.login).toEqual({ headline: "Welcome home", blurb: defaults.login.blurb });
    expect(s.bankAccounts).toEqual([{ key: "building", label: "Building Fund" }]);
    expect(s.meetingTypes).toEqual(["Board", "AGM"]);
    expect(s.departmentSuggestions).toEqual(defaults.departmentSuggestions);
    expect(s.attendance).toEqual({ activeMinSundays: 3, absenceAlertAfter: defaults.attendance.absenceAlertAfter });
  });

  it("are checked before saving", () => {
    expect(validateOrgSettings(defaults)).toBeNull();
    expect(validateOrgSettings({ ...defaults, bankAccounts: [] })).toMatch(/at least one/);
    expect(validateOrgSettings({ ...defaults, attendance: { activeMinSundays: 0, absenceAlertAfter: 2 } })).toMatch(/between 1 and 12/);
    expect(
      validateOrgSettings({ ...defaults, bankAccounts: [{ key: "a", label: "Main" }, { key: "b", label: "main" }] })
    ).toMatch(/same name/);
  });

  it("make stable keys for new bank accounts", () => {
    expect(accountKeyFrom("Building Fund", [])).toBe("building_fund");
    expect(accountKeyFrom("Building Fund", ["building_fund"])).toBe("building_fund_2");
  });
});

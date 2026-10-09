import { describe, expect, it } from "vitest";
import { graduationState, monthLabel, nextAgeGroup } from "./graduation";

const groups = [
  { key: "adults", label: "Adults", minAge: 36 },
  { key: "children", label: "Children", minAge: 0, maxAge: 12 },
  { key: "teens", label: "Teens", minAge: 13, maxAge: 19 },
];

describe("nextAgeGroup", () => {
  it("is the group that starts next, whatever the order given", () => {
    expect(nextAgeGroup(groups, "children")?.key).toBe("teens");
  });
  it("is nothing for the last group or an unknown one", () => {
    expect(nextAgeGroup(groups, "adults")).toBeUndefined();
    expect(nextAgeGroup(groups, "nope")).toBeUndefined();
  });
});

describe("graduationState", () => {
  it("has nothing without a month", () => expect(graduationState(null, "2026-10-09")).toBe("none"));
  it("is overdue once the month has passed", () => expect(graduationState("2026-09-01", "2026-10-09")).toBe("overdue"));
  it("is soon this month and the next two", () => {
    expect(graduationState("2026-10-01", "2026-10-09")).toBe("soon");
    expect(graduationState("2026-12-01", "2026-10-09")).toBe("soon");
  });
  it("is later after that, across a year end", () => {
    expect(graduationState("2027-01-01", "2026-10-09")).toBe("later");
    expect(graduationState("2027-01-01", "2026-11-20")).toBe("soon");
    expect(graduationState("2027-02-01", "2026-11-20")).toBe("later");
  });
});

describe("monthLabel", () => {
  it("names the month and year", () => expect(monthLabel("2027-03-01")).toMatch(/March 2027/));
});

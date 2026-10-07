import { describe, expect, it } from "vitest";
import { attendanceStatus, consecutiveMissedSundays, needsFollowUp, sundayServicesFor, type ServiceLite } from "./rules";

const sunday = (id: string, date: string, churchId = "loc"): ServiceLite => ({ id, churchId, date, kind: "sunday" });
const services: ServiceLite[] = [
  sunday("s1", "2026-09-13"),
  sunday("s2", "2026-09-20"),
  sunday("s3", "2026-09-27"),
  sunday("s4", "2026-10-04"),
  { id: "mid", churchId: "loc", date: "2026-10-01", kind: "midweek" },
  sunday("other", "2026-10-04", "elsewhere"),
  sunday("future", "2026-10-11"),
];
const today = "2026-10-07";
const sundays = sundayServicesFor(services, "loc", today);

describe("attendance rules", () => {
  it("only counts the location's own Sunday services up to today, newest first", () => {
    expect(sundays.map((s) => s.id)).toEqual(["s4", "s3", "s2", "s1"]);
  });

  it("counts missed Sundays back to the last one attended", () => {
    expect(consecutiveMissedSundays(sundays, new Set(["s4"]))).toBe(0);
    expect(consecutiveMissedSundays(sundays, new Set(["s2"]))).toBe(2);
    expect(consecutiveMissedSundays(sundays, new Set(["mid", "other"]))).toBe(4);
  });

  it("flags follow-up after 2 missed Sundays in a row", () => {
    expect(needsFollowUp(sundays, new Set(["s3"]))).toBe(false);
    expect(needsFollowUp(sundays, new Set(["s2"]))).toBe(true);
  });

  it("is active with 2+ Sundays in the last 30 days", () => {
    expect(attendanceStatus(sundays, new Set(["s2", "s4"]), today)).toBe("active");
    expect(attendanceStatus(sundays, new Set(["s4"]), today)).toBe("irregular");
  });

  it("doesn't judge until enough Sundays have been recorded", () => {
    expect(attendanceStatus([sunday("only", "2026-10-04")], new Set(), today)).toBe("unknown");
  });
});

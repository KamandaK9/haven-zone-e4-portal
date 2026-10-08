import { describe, expect, it } from "vitest";
import { daysBetween, isStuck, stageOf, type JourneyFacts } from "./stages";

const base: JourneyFacts = { isVisitor: true, hasCell: false, enrolledInCourse: false, contacted: false, serves: false };

describe("stageOf", () => {
  it("takes the furthest step reached", () => {
    expect(stageOf(base)).toBe("new");
    expect(stageOf({ ...base, contacted: true })).toBe("contacted");
    expect(stageOf({ ...base, contacted: true, hasCell: true })).toBe("cell");
    expect(stageOf({ ...base, hasCell: true, enrolledInCourse: true })).toBe("course");
  });
  it("a confirmed member is a member, or a worker if they serve", () => {
    expect(stageOf({ ...base, isVisitor: false })).toBe("member");
    expect(stageOf({ ...base, isVisitor: false, serves: true })).toBe("worker");
    // Serving doesn't skip an unconfirmed newcomer ahead.
    expect(stageOf({ ...base, serves: true })).toBe("new");
  });
});

describe("isStuck", () => {
  it("flags people left too long at the early steps only", () => {
    expect(isStuck("new", 7)).toBe(false);
    expect(isStuck("new", 8)).toBe(true);
    expect(isStuck("contacted", 22)).toBe(true);
    expect(isStuck("course", 400)).toBe(false);
    expect(isStuck("member", 400)).toBe(false);
  });
});

it("daysBetween counts whole days", () => {
  expect(daysBetween("2026-10-01", "2026-10-08")).toBe(7);
  expect(daysBetween("2026-10-08", "2026-10-01")).toBe(0);
});

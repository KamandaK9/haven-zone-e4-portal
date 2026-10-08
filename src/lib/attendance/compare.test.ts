import { expect, it } from "vitest";
import { compareSubGroups } from "./compare";

it("sets sub-groups side by side", () => {
  const standing = new Map([
    ["a1", { memberId: "a1", status: "active" as const, missedInARow: 0 }],
    ["a2", { memberId: "a2", status: "irregular" as const, missedInARow: 3 }],
    ["b1", { memberId: "b1", status: "active" as const, missedInARow: 0 }],
  ]);
  const rows = compareSubGroups({
    churchIds: ["A", "B"],
    members: [
      { id: "a1", churchId: "A", isVisitor: false },
      { id: "a2", churchId: "A", isVisitor: false },
      { id: "av", churchId: "A", isVisitor: true, joinDate: "2026-10-04" },
      { id: "b1", churchId: "B", isVisitor: false },
    ],
    standing,
    services: [
      { id: "s1", churchId: "A", date: "2026-10-04", kind: "sunday", attendees: 30 },
      { id: "s2", churchId: "A", date: "2026-09-27", kind: "sunday", attendees: 20 },
      { id: "s3", churchId: "B", date: "2026-10-04", kind: "sunday", attendees: 12 },
      { id: "mid", churchId: "B", date: "2026-10-01", kind: "midweek", attendees: 99 },
    ],
    courseCompletedByMember: new Set(["a1"]),
    today: "2026-10-08",
  });
  expect(rows[0]).toEqual({ churchId: "A", members: 2, activePct: 50, averageSunday: 25, firstTimers: 1, needFollowUp: 1, courseCompleted: 1 });
  expect(rows[1]).toEqual({ churchId: "B", members: 1, activePct: 100, averageSunday: 12, firstTimers: 0, needFollowUp: 0, courseCompleted: 0 });
});

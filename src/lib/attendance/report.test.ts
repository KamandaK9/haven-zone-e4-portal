import { expect, it } from "vitest";
import { firstTimerReturns, sundayTrend } from "./report";

it("adds up Sunday attendance per date and location", () => {
  const t = sundayTrend([
    { id: "a", churchId: "x", date: "2026-10-04", kind: "sunday", attendees: 100 },
    { id: "b", churchId: "y", date: "2026-10-04", kind: "sunday", attendees: 40 },
    { id: "c", churchId: "x", date: "2026-09-27", kind: "sunday", attendees: 90 },
    { id: "d", churchId: "x", date: "2026-10-01", kind: "midweek", attendees: 30 },
  ]);
  expect(t).toEqual([
    { date: "2026-09-27", total: 90, byChurch: { x: 90 } },
    { date: "2026-10-04", total: 140, byChurch: { x: 100, y: 40 } },
  ]);
});

it("counts first-timers who came back", () => {
  const services = [
    { id: "s1", churchId: "x", date: "2026-09-27", kind: "sunday" },
    { id: "s2", churchId: "x", date: "2026-10-04", kind: "sunday" },
  ];
  const r = firstTimerReturns(
    [{ id: "v1", joinDate: "2026-09-27" }, { id: "v2", joinDate: "2026-09-27" }],
    services,
    [{ serviceId: "s1", memberId: "v1" }, { serviceId: "s2", memberId: "v1" }, { serviceId: "s1", memberId: "v2" }]
  );
  expect(r).toEqual({ total: 2, returned: 1 });
});

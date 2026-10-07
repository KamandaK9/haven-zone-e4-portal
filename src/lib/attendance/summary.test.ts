import { expect, it } from "vitest";
import { summarise } from "./summary";

it("works out each member's standing from the record", () => {
  const services = [
    { id: "a", churchId: "loc", date: "2026-09-20", kind: "sunday" },
    { id: "b", churchId: "loc", date: "2026-09-27", kind: "sunday" },
    { id: "c", churchId: "loc", date: "2026-10-04", kind: "sunday" },
  ];
  const members = [
    { id: "regular", churchId: "loc" },
    { id: "drifting", churchId: "loc" },
    { id: "elsewhere", churchId: "new-loc" },
  ];
  const attendance = [
    { serviceId: "b", memberId: "regular" },
    { serviceId: "c", memberId: "regular" },
    { serviceId: "a", memberId: "drifting" },
  ];
  const s = summarise(members, services, attendance, "2026-10-07");
  expect(s.get("regular")).toMatchObject({ status: "active", missedInARow: 0, lastAttended: "2026-10-04" });
  expect(s.get("drifting")).toMatchObject({ status: "irregular", missedInARow: 2, lastAttended: "2026-09-20" });
  expect(s.get("elsewhere")).toMatchObject({ status: "unknown", missedInARow: 0 });
});

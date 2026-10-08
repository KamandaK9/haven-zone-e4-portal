import { expect, it } from "vitest";
import { summariseCells } from "./meetings";

it("works out each cell's rhythm and flags quiet ones", () => {
  const out = summariseCells(
    ["a", "b", "c"],
    [
      { cellId: "a", date: "2026-10-01", attendees: 10 },
      { cellId: "a", date: "2026-09-24", attendees: 6 },
      { cellId: "b", date: "2026-09-02", attendees: 8 },
    ],
    "2026-10-08"
  );
  expect(out[0]).toMatchObject({ cellId: "a", meetings: 2, averageAttendance: 8, lastMet: "2026-10-01", daysSinceLastMet: 7, quiet: false });
  expect(out[1]).toMatchObject({ cellId: "b", lastMet: "2026-09-02", daysSinceLastMet: 36, quiet: true });
  expect(out[2]).toMatchObject({ cellId: "c", meetings: 0, quiet: true, averageAttendance: 0 });
});

import { expect, it } from "vitest";
import { canActOn } from "@/lib/access";
import { assignableRoles } from "./roles";
import { effectiveModules } from "@/lib/modules";

const modules = effectiveModules([]);

it("you can only give roles below your own", () => {
  const keys = (actor: string) => assignableRoles(actor as never, modules).map((r) => r.key);
  expect(keys("location_pastor")).not.toContain("group_pastor");
  expect(keys("location_pastor")).not.toContain("location_pastor");
  expect(keys("location_pastor")).toEqual(expect.arrayContaining(["cell_leader", "senior_cell_leader", "checkin_volunteer", "member"]));
  expect(keys("cell_leader")).not.toContain("senior_cell_leader");
  expect(canActOn("group_pastor" as never, "system_admin" as never)).toBe(false);
});

it("every role says what it's for and what it sees", () => {
  for (const r of assignableRoles("system_admin" as never, modules)) {
    expect(r.description, r.key).toBeTruthy();
    expect(r.sees, r.key).toBeTruthy();
  }
});

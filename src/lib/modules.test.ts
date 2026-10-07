import { expect, it, vi } from "vitest";

vi.mock("@/tenant", async (importOriginal) => {
  const { tenant } = await importOriginal<typeof import("@/tenant")>();
  return { tenant: { ...tenant, modules: { ...tenant.modules, attendance: true, courses: true, ledger: false } } };
});

import { effectiveModules } from "./modules";

it("a feature is on when it's in the plan and not switched off", () => {
  expect(effectiveModules([]).attendance).toBe(true);
  expect(effectiveModules(["attendance"]).attendance).toBe(false);
  expect(effectiveModules(["attendance"]).courses).toBe(true);
  // Not in the plan: switching it "on" in the database can't turn it on.
  expect(effectiveModules([]).ledger).toBe(false);
});

import { expect, it, vi } from "vitest";
import { editionFor } from "./editions";

// Two features this edition has, whatever the edition: one in the plan, one not.
const { tenant: real } = await vi.importActual<typeof import("@/tenant")>("@/tenant");
const [onKey, alsoOn, offKey] = editionFor(real.edition).modules;

vi.mock("@/tenant", async (importOriginal) => {
  const { tenant } = await importOriginal<typeof import("@/tenant")>();
  const [a, b, c] = editionFor(tenant.edition).modules;
  return { tenant: { ...tenant, modules: { ...tenant.modules, [a]: true, [b]: true, [c]: false } } };
});

const { effectiveModules } = await import("./modules");

it("a feature is on when it's in the plan and not switched off", () => {
  expect(effectiveModules([])[onKey]).toBe(true);
  expect(effectiveModules([onKey])[onKey]).toBe(false);
  expect(effectiveModules([onKey])[alsoOn]).toBe(true);
  // Not in the plan: switching it "on" in the database can't turn it on.
  expect(effectiveModules([])[offKey]).toBe(false);
});

it("a feature outside the edition is never on", () => {
  const outside = (["giving", "attendance", "courses", "messaging"] as const).filter((k) => !editionFor(real.edition).modules.includes(k));
  for (const k of outside) expect(effectiveModules([])[k]).toBe(false);
});

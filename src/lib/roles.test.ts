import { expect, it } from "vitest";
import { assignableRoles } from "./roles";
import { effectiveModules } from "@/lib/modules";
import { tenant } from "@/tenant";

// Checks the rule for whatever roles the tenant defines.
const modules = effectiveModules([]);
const positions = [...tenant.access.positions].sort((a, b) => a.rank - b.rank);
const rankOf = (key: string) => positions.find((p) => p.key === key)!.rank;

it("you can only give roles ranked below your own", () => {
  for (const actor of positions) {
    for (const r of assignableRoles(actor.key as never, modules)) expect(rankOf(r.key), `${actor.key} → ${r.key}`).toBeGreaterThan(actor.rank);
  }
  // The most senior role can give every other role; the least senior, none.
  expect(assignableRoles(positions[0].key as never, modules).length).toBe(positions.filter((p) => p.rank > positions[0].rank).length);
  expect(assignableRoles(positions.at(-1)!.key as never, modules)).toEqual([]);
});

it("every role says what it sees", () => {
  for (const r of assignableRoles(positions[0].key as never, modules)) expect(r.sees, r.key).toBeTruthy();
});

import { expect, it } from "vitest";
import { gettingStartedSteps } from "./steps";
import { effectiveModules } from "@/lib/modules";

const modules = effectiveModules([]);

const none = { locations: 1, members: 0, cells: 0, logins: 1, logos: 0, cohorts: 0, services: 0 };

it("ticks steps off from what exists, and manual ones when marked", () => {
  const fresh = gettingStartedSteps(none, [], modules);
  expect(fresh.every((s) => !s.done)).toBe(true);
  const later = gettingStartedSteps({ ...none, members: 300, cells: 12, logins: 4 }, ["locations"], modules);
  expect(later.filter((s) => s.done).map((s) => s.key)).toEqual(["locations", "members", "cells", "leaders"]);
});

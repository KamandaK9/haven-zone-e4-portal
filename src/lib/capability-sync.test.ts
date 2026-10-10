import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { gainedCapabilities } = await import("./capability-sync");
const { CAPABILITIES, defaultCapabilities } = await import("./access");
const { tenant } = await import("@/tenant");

describe("gainedCapabilities", () => {
  // A position that holds at least one capability by default.
  const def = tenant.access.positions.find((p) => p.baseCaps.length > 0 && p.key !== tenant.access.rootPositionKey)!;
  const cap = def.baseCaps[0];

  it("gives a new capability to logins whose position holds it by default", () => {
    expect(gainedCapabilities({ position: def.key, portfolio: null, caps: [], revoked: [] }, [cap])).toEqual([cap]);
  });

  it("leaves it out where it was revoked, already held, or not new", () => {
    expect(gainedCapabilities({ position: def.key, portfolio: null, caps: [], revoked: [cap] }, [cap])).toEqual([]);
    expect(gainedCapabilities({ position: def.key, portfolio: null, caps: [cap], revoked: [] }, [cap])).toEqual([]);
    expect(gainedCapabilities({ position: def.key, portfolio: null, caps: [], revoked: [] }, [])).toEqual([]);
  });

  it("doesn't give members anything", () => {
    const member = tenant.access.memberPositionKey;
    expect(defaultCapabilities(member, null)).toEqual([]);
    expect(gainedCapabilities({ position: member, portfolio: null, caps: [], revoked: [] }, [...CAPABILITIES])).toEqual([]);
  });

  it("ignores positions the tenant doesn't define", () => {
    expect(gainedCapabilities({ position: "no_such_position", portfolio: null, caps: [], revoked: [] }, [...CAPABILITIES])).toEqual([]);
  });
});

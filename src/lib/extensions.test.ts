import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const ran: string[] = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => fn() }));
vi.mock("@/tenant/extensions", () => ({
  extensions: {
    hooks: {
      onMembersCreated: async (e: { memberIds: string[] }) => {
        ran.push(...e.memberIds);
      },
      onMemberDeleted: async () => {
        throw new Error("CRM is down");
      },
      daily: async () => {
        throw new Error("nope");
      },
    },
  },
}));

const { fireHook, runDailyExtension } = await import("./extensions");

describe("extension hooks", () => {
  it("run with the event after the action", async () => {
    fireHook("onMembersCreated", { zoneId: "z", memberIds: ["a", "b"], source: "import" });
    await Promise.resolve();
    expect(ran).toEqual(["a", "b"]);
  });

  it("never let a failing hook reach the action", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => fireHook("onMemberDeleted", { zoneId: "z", memberId: "m" })).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(log).toHaveBeenCalled();
    await expect(runDailyExtension()).resolves.toEqual({ error: "Error: nope" });
    log.mockRestore();
  });

  it("do nothing for hooks a client doesn't define", () => {
    expect(() => fireHook("onGivingImported", { zoneId: "z", rows: 3 })).not.toThrow();
  });
});

import { describe, expect, it, vi } from "vitest";

// Fixed settings, so the test doesn't depend on the deployment's tenant.
vi.mock("@/tenant", () => ({ tenant: { name: "Test Church", messaging: { countryCode: "27", minorAgeGroups: ["children", "teens"] } } }));

import { buildRecipients, type MemberForMessage } from "./recipients";

const member = (over: Partial<MemberForMessage>): MemberForMessage => ({
  id: crypto.randomUUID(), first_name: "Thabo", last_name: "Mokoena", email: null, phone: "082 123 4567", age_group: "adults",
  guardian_name: null, guardian_phone: null, messaging_opt_out: false, ...over,
});

describe("buildRecipients", () => {
  it("texts adults themselves, filling in their name", () => {
    const { recipients } = buildRecipients([member({})], "sms", { self: "Hi {first_name}, from {church}" });
    expect(recipients).toHaveLength(1);
    expect(recipients[0]).toMatchObject({ to: "+27821234567", via: "self" });
    expect(recipients[0].body).toMatch(/^Hi Thabo, from /);
  });

  it("sends minors' messages to their guardian, saying who it's for", () => {
    const kid = member({ first_name: "Lerato", age_group: "children", phone: "0829990000", guardian_name: "Mrs Dlamini", guardian_phone: "0711112222" });
    const { recipients } = buildRecipients([kid], "sms", { self: "Join us Sunday" });
    expect(recipients[0]).toMatchObject({ to: "+27711112222", via: "guardian" });
    expect(recipients[0].body).toBe("(For Lerato) Join us Sunday");
    const own = buildRecipients([kid], "sms", { self: "x", guardian: "Hi {guardian_name}, about {first_name}" }).recipients[0];
    expect(own.body).toBe("Hi Mrs Dlamini, about Lerato");
  });

  it("never texts a minor directly, even if they have their own number", () => {
    const kid = member({ age_group: "teens", phone: "0829990000" });
    const r = buildRecipients([kid], "sms", { self: "x" });
    expect(r.recipients).toEqual([]);
    expect(r.skipped.noGuardian).toBe(1);
  });

  it("skips opt-outs and people with no number, and counts them", () => {
    const r = buildRecipients([member({ messaging_opt_out: true }), member({ phone: null }), member({ phone: "abc" }), member({})], "sms", { self: "x" });
    expect(r.recipients).toHaveLength(1);
    expect(r.skipped).toMatchObject({ optedOut: 1, noContact: 2 });
  });

  it("sends a shared number the same text once", () => {
    const a = member({ first_name: "A" }), b = member({ first_name: "B" });
    expect(buildRecipients([a, b], "sms", { self: "Service is at 9" }).recipients).toHaveLength(1);
    expect(buildRecipients([a, b], "sms", { self: "Hi {first_name}" }).recipients).toHaveLength(2);
  });

  it("adds the opt-out footer to texts, and counts segments", () => {
    const { recipients } = buildRecipients([member({})], "sms", { self: "Hello" }, { footer: "Reply STOP to opt out." });
    expect(recipients[0].body).toBe("Hello\nReply STOP to opt out.");
    expect(recipients[0].segments).toBe(1);
  });

  it("emails members by address, and never minors", () => {
    const r = buildRecipients([member({ email: "T@Example.org" }), member({ age_group: "children", email: "kid@example.org" })], "email", { self: "x" });
    expect(r.recipients.map((x) => x.to)).toEqual(["t@example.org"]);
    expect(r.skipped.noGuardian).toBe(1);
  });
});

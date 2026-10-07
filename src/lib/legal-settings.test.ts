import { describe, expect, it } from "vitest";
import { applyLegalOverrides, nextNoticeVersion, validateLegal } from "./legal-settings";
import type { LegalConfig } from "./tenant";

const defaults: LegalConfig = {
  organisationName: "[Registered name]",
  physicalAddress: "[Address]",
  jurisdiction: "ZA",
  informationOfficer: { name: "[IO]", email: "[email]" },
  privacyNoticeVersion: "2026-10-07",
  religiousBody: true,
  operators: [{ name: "Supabase", purpose: "Database", location: "[Region]" }],
  retention: { membersAfterLeaving: 2, financial: 5, auditLog: 5, supportAndRequests: 2 },
};

describe("applyLegalOverrides", () => {
  it("keeps the defaults when nothing is stored", () => {
    expect(applyLegalOverrides(defaults, null)).toBe(defaults);
  });

  it("applies stored details over the defaults", () => {
    const l = applyLegalOverrides(defaults, {
      organisationName: "Grace Church NPC",
      informationOfficer: { name: "J Doe", email: "io@grace.org", phone: "011" },
      operators: [{ name: "Supabase", purpose: "Database", location: "Frankfurt" }],
      retention: { financial: 7 },
      privacyNoticeVersion: "2026-11-01",
    });
    expect(l.organisationName).toBe("Grace Church NPC");
    expect(l.informationOfficer).toEqual({ name: "J Doe", email: "io@grace.org", phone: "011" });
    expect(l.operators[0].location).toBe("Frankfurt");
    expect(l.retention).toEqual({ membersAfterLeaving: 2, financial: 7, auditLog: 5, supportAndRequests: 2 });
    expect(l.privacyNoticeVersion).toBe("2026-11-01");
    expect(l.jurisdiction).toBe("ZA");
  });

  it("ignores malformed stored values field by field", () => {
    const l = applyLegalOverrides(defaults, { organisationName: 42, informationOfficer: { name: "No email" }, retention: { financial: -3 }, operators: [] });
    expect(l.organisationName).toBe(defaults.organisationName);
    expect(l.informationOfficer).toEqual(defaults.informationOfficer);
    expect(l.retention.financial).toBe(5);
    expect(l.operators).toEqual(defaults.operators);
  });

  it("lets a deputy be removed", () => {
    const withDeputy = { ...defaults, deputyInformationOfficer: { name: "D", email: "d@x.org" } };
    expect(applyLegalOverrides(withDeputy, { deputyInformationOfficer: null }).deputyInformationOfficer).toBeUndefined();
  });
});

describe("validateLegal", () => {
  const good = applyLegalOverrides(defaults, {
    organisationName: "Grace Church NPC",
    physicalAddress: "1 Main Rd",
    informationOfficer: { name: "J Doe", email: "io@grace.org" },
  });
  it("accepts complete details", () => {
    expect(validateLegal(good)).toBeNull();
  });
  it("rejects a bad Information Officer email", () => {
    expect(validateLegal({ ...good, informationOfficer: { name: "J", email: "nope" } })).toMatch(/valid email/);
  });
  it("needs every provider to say where it's based", () => {
    expect(validateLegal({ ...good, operators: [{ name: "X", purpose: "Y", location: " " }] })).toMatch(/where it's based/);
  });
});

describe("nextNoticeVersion", () => {
  const today = new Date("2026-11-01T10:00:00Z");
  it("uses today's date", () => {
    expect(nextNoticeVersion("2026-10-07", today)).toBe("2026-11-01");
  });
  it("adds a suffix for a second change on the same day", () => {
    expect(nextNoticeVersion("2026-11-01", today)).toBe("2026-11-01.2");
    expect(nextNoticeVersion("2026-11-01.2", today)).toBe("2026-11-01.3");
  });
});

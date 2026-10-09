import { createHmac } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { twilioSignatureValid } from "./twilio";

afterEach(() => vi.unstubAllEnvs());

it("accepts Twilio's own signature and nothing else", () => {
  vi.stubEnv("TWILIO_AUTH_TOKEN", "secret-token");
  const url = "https://portal.example.org/api/messaging/twilio-inbound";
  const fields = { From: "+27821234567", Body: "STOP", MessageSid: "SM1" };
  const sig = createHmac("sha1", "secret-token").update(url + "BodySTOPFrom+27821234567MessageSidSM1").digest("base64");
  expect(twilioSignatureValid(url, fields, sig)).toBe(true);
  expect(twilioSignatureValid(url, { ...fields, Body: "START" }, sig)).toBe(false);
  expect(twilioSignatureValid(url, fields, null)).toBe(false);
  expect(twilioSignatureValid(url, fields, "not-it")).toBe(false);
});

import { describe, expect, it } from "vitest";
import { birthdayMonthDay, phoneKey, renderMessage, smsSegments, toE164 } from "./text";

describe("smsSegments", () => {
  it("counts GSM text at 160 / 153", () => {
    expect(smsSegments("a".repeat(160))).toMatchObject({ segments: 1, unicode: false });
    expect(smsSegments("a".repeat(161)).segments).toBe(2);
    expect(smsSegments("a".repeat(306)).segments).toBe(2);
    expect(smsSegments("a".repeat(307)).segments).toBe(3);
  });
  it("counts extension characters twice", () => {
    expect(smsSegments("€".repeat(80)).segments).toBe(1);
    expect(smsSegments("€".repeat(81)).segments).toBe(2);
  });
  it("switches to Unicode (70 / 67) for emoji and curly quotes", () => {
    expect(smsSegments("Welcome 🙏")).toMatchObject({ segments: 1, unicode: true });
    expect(smsSegments("It’s a blessing")).toMatchObject({ unicode: true });
    expect(smsSegments("🙏".repeat(36)).segments).toBe(2); // 72 units
  });
});

describe("renderMessage", () => {
  it("fills tags and leaves unknown ones visible", () => {
    expect(renderMessage("Hi {first_name}, from {church}", { first_name: "Thabo" })).toBe("Hi Thabo, from {church}");
    expect(renderMessage("Hi {guardian_name}", {})).toBe("Hi {guardian_name}");
  });
});

describe("toE164", () => {
  it("accepts the ways South Africans write numbers", () => {
    for (const n of ["082 123 4567", "0821234567", "+27 82 123 4567", "27821234567", "0027821234567", "821234567"]) {
      expect(toE164(n), n).toBe("+27821234567");
    }
  });
  it("keeps other countries' numbers and rejects junk", () => {
    expect(toE164("+263 77 123 4567")).toBe("+263771234567");
    expect(toE164("12345")).toBeUndefined();
    expect(toE164("")).toBeUndefined();
    expect(toE164(undefined)).toBeUndefined();
  });
});

it("phoneKey and birthdayMonthDay", () => {
  expect(phoneKey("+27 82 123 4567")).toBe(phoneKey("0821234567"));
  expect(phoneKey("123")).toBeUndefined();
  expect(birthdayMonthDay("04-12")).toEqual({ month: 4, day: 12 });
  expect(birthdayMonthDay("1990-04-12")).toEqual({ month: 4, day: 12 });
  expect(birthdayMonthDay("12th of April")).toBeUndefined();
  expect(birthdayMonthDay("13-45")).toBeUndefined();
});

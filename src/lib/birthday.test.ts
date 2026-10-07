import { expect, it } from "vitest";
import { formatBirthday } from "./birthday";

it("formats stored birthdays, passing free text through", () => {
  expect(formatBirthday("1990-04-12")).toBe("12 April 1990");
  expect(formatBirthday("04-12")).toBe("12 April");
  expect(formatBirthday("12th of April")).toBe("12th of April");
});

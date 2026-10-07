import { expect, it } from "vitest";
import { bestLogo, isLowRes } from "./best-logo";

const png = (id: string, w: number, createdAt = "2026-10-01") => ({ id, mime: "image/png", fileName: `${id}.png`, width: w, height: w, createdAt });

it("offers a vector original over any image, then the largest image", () => {
  expect(bestLogo([png("small", 500), png("big", 4000)])?.id).toBe("big");
  expect(bestLogo([png("big", 4000), { id: "svg", mime: "image/svg+xml", fileName: "logo.svg", createdAt: "2026-01-01" }])?.id).toBe("svg");
  expect(bestLogo([png("old", 2000, "2026-01-01"), png("new", 2000, "2026-10-01")])?.id).toBe("new");
  expect(bestLogo([])).toBeUndefined();
});

it("flags small raster logos", () => {
  expect(isLowRes(png("tiny", 500))).toBe(true);
  expect(isLowRes(png("ok", 2000))).toBe(false);
  expect(isLowRes({ id: "v", mime: "application/pdf", fileName: "logo.pdf", createdAt: "" })).toBe(false);
});

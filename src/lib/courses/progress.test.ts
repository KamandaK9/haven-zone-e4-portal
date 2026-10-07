import { expect, it } from "vitest";
import { courseProgress } from "./progress";

it("counts distinct classes of this course, make-ups included", () => {
  const classes = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];
  expect(courseProgress(["c1", "c2", "c2", "other"], classes, 7)).toEqual({ attended: 2, required: 7, completed: false });
  expect(courseProgress(classes, classes, 7)).toEqual({ attended: 7, required: 7, completed: true });
});

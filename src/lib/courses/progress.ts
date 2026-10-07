// How far a member is through a course: distinct classes attended, in any
// cohort (make-ups count), against the number that completes it.
export type CourseProgress = { attended: number; required: number; completed: boolean };

export function courseProgress(attendedClassIds: Iterable<string>, courseClassIds: Iterable<string>, required: number): CourseProgress {
  const inCourse = new Set(courseClassIds);
  const attended = new Set([...attendedClassIds].filter((id) => inCourse.has(id))).size;
  return { attended, required, completed: attended >= required };
}

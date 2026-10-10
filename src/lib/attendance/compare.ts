import type { MemberAttendance } from "./summary";
import type { ServiceLite } from "./rules";
import { ATTENDANCE_RULES, type AttendanceRules } from "./rules";

// One row per sub-group, so a Group Pastor can see them side by side.

export type SubGroupRow = {
  churchId: string;
  members: number;
  activePct: number; // of regular members, rounded
  averageSunday: number;
  firstTimers: number; // joined in the last 30 days
  needFollowUp: number;
  courseCompleted: number;
};

export function compareSubGroups(input: {
  churchIds: string[];
  members: { id: string; churchId: string; isVisitor: boolean; joinDate?: string }[];
  standing: Map<string, MemberAttendance>;
  services: (ServiceLite & { attendees: number })[];
  courseCompletedByMember: Set<string>;
  today: string;
  rules?: AttendanceRules;
}): SubGroupRow[] {
  const rules = input.rules ?? ATTENDANCE_RULES;
  const monthAgo = new Date(Date.parse(`${input.today}T12:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10);
  return input.churchIds.map((churchId) => {
    const mine = input.members.filter((m) => m.churchId === churchId);
    const regulars = mine.filter((m) => !m.isVisitor);
    const active = regulars.filter((m) => input.standing.get(m.id)?.status === "active").length;
    const sundays = new Map<string, number>();
    for (const s of input.services) if (s.kind === "sunday" && s.churchId === churchId) sundays.set(s.date, (sundays.get(s.date) ?? 0) + s.attendees);
    const counts = [...sundays.values()];
    return {
      churchId,
      members: regulars.length,
      activePct: regulars.length ? Math.round((active / regulars.length) * 100) : 0,
      averageSunday: counts.length ? Math.round(counts.reduce((n, c) => n + c, 0) / counts.length) : 0,
      firstTimers: mine.filter((m) => m.isVisitor && (m.joinDate ?? "") >= monthAgo).length,
      needFollowUp: regulars.filter((m) => (input.standing.get(m.id)?.missedInARow ?? 0) >= rules.absenceAlertAfter).length,
      courseCompleted: regulars.filter((m) => input.courseCompletedByMember.has(m.id)).length,
    };
  });
}

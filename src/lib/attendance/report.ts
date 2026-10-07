import type { ServiceLite } from "./rules";
import type { AttendanceRow } from "./summary";

// Figures for the attendance report, from the services and check-ins on record.

export type WeekPoint = { date: string; total: number; byChurch: Record<string, number> };

// Sunday attendance per date (newest last), split by location.
export function sundayTrend(services: (ServiceLite & { attendees: number })[]): WeekPoint[] {
  const byDate = new Map<string, WeekPoint>();
  for (const s of services) {
    if (s.kind !== "sunday") continue;
    const p = byDate.get(s.date) ?? { date: s.date, total: 0, byChurch: {} };
    p.total += s.attendees;
    p.byChurch[s.churchId] = (p.byChurch[s.churchId] ?? 0) + s.attendees;
    byDate.set(s.date, p);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// First-timers and how many came back to at least one later service.
export function firstTimerReturns(
  visitors: { id: string; joinDate?: string }[],
  services: ServiceLite[],
  attendance: AttendanceRow[]
): { total: number; returned: number } {
  const dateOf = new Map(services.map((s) => [s.id, s.date]));
  let returned = 0;
  for (const v of visitors) {
    const dates = attendance.filter((a) => a.memberId === v.id).map((a) => dateOf.get(a.serviceId)).filter(Boolean) as string[];
    if (dates.some((d) => !v.joinDate || d > v.joinDate)) returned++;
  }
  return { total: visitors.length, returned };
}

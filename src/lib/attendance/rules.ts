import { tenant } from "@/tenant";

// The church's attendance rules, as pure functions of a member's record:
// - active: at least `activeMinSundays` Sunday services in the last 30 days;
// - absence alert: `absenceAlertAfter` Sunday services missed in a row.
// Only Sunday services at the member's own location count. Thresholds come
// from tenant.attendance (CE Sandton: 2 and 2, from the pastor).

export const ATTENDANCE_RULES = {
  activeMinSundays: tenant.attendance?.activeMinSundays ?? 2,
  absenceAlertAfter: tenant.attendance?.absenceAlertAfter ?? 2,
};

export type ServiceLite = { id: string; churchId: string; date: string; kind: string };

// A location's Sunday services, newest first, up to and including `today`.
export function sundayServicesFor(services: ServiceLite[], churchId: string, today: string): ServiceLite[] {
  return services
    .filter((s) => s.churchId === churchId && s.kind === "sunday" && s.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// How many of the location's most recent Sundays in a row the member missed,
// counting back from the latest until one they attended.
export function consecutiveMissedSundays(sundaysNewestFirst: ServiceLite[], attended: Set<string>): number {
  let missed = 0;
  for (const s of sundaysNewestFirst) {
    if (attended.has(s.id)) break;
    missed++;
  }
  return missed;
}

export type AttendanceStatus = "active" | "irregular" | "unknown";

function daysBefore(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// "unknown" until the location has recorded enough Sundays in the window to
// judge — a church that has only just started checking people in shouldn't
// mark everyone irregular.
export function attendanceStatus(sundaysNewestFirst: ServiceLite[], attended: Set<string>, today: string): AttendanceStatus {
  const since = daysBefore(today, 30);
  const inWindow = sundaysNewestFirst.filter((s) => s.date > since);
  if (inWindow.length < ATTENDANCE_RULES.activeMinSundays) return "unknown";
  const count = inWindow.filter((s) => attended.has(s.id)).length;
  return count >= ATTENDANCE_RULES.activeMinSundays ? "active" : "irregular";
}

export function needsFollowUp(sundaysNewestFirst: ServiceLite[], attended: Set<string>): boolean {
  return consecutiveMissedSundays(sundaysNewestFirst, attended) >= ATTENDANCE_RULES.absenceAlertAfter;
}

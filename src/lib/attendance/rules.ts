import { tenant } from "@/tenant";

// The church's attendance rules, as pure functions of a member's record:
// - active: at least `activeMinSundays` Sunday services in the last 30 days;
// - absence alert: `absenceAlertAfter` Sunday services missed in a row.
// Only Sunday services at the member's own location count. Thresholds come
// come from the organisation's settings (Settings → Organisation); these are
// the defaults, from tenant.attendance.

export type AttendanceRules = { activeMinSundays: number; absenceAlertAfter: number };

export const ATTENDANCE_RULES: AttendanceRules = {
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
export function attendanceStatus(
  sundaysNewestFirst: ServiceLite[],
  attended: Set<string>,
  today: string,
  rules: AttendanceRules = ATTENDANCE_RULES
): AttendanceStatus {
  const since = daysBefore(today, 30);
  const inWindow = sundaysNewestFirst.filter((s) => s.date > since);
  if (inWindow.length < rules.activeMinSundays) return "unknown";
  const count = inWindow.filter((s) => attended.has(s.id)).length;
  return count >= rules.activeMinSundays ? "active" : "irregular";
}

export function needsFollowUp(sundaysNewestFirst: ServiceLite[], attended: Set<string>, rules: AttendanceRules = ATTENDANCE_RULES): boolean {
  return consecutiveMissedSundays(sundaysNewestFirst, attended) >= rules.absenceAlertAfter;
}

import { attendanceStatus, consecutiveMissedSundays, sundayServicesFor, type AttendanceStatus, type ServiceLite } from "./rules";

export type AttendanceRow = { serviceId: string; memberId: string };

export type MemberAttendance = {
  memberId: string;
  status: AttendanceStatus;
  missedInARow: number;
  lastAttended?: string; // service date
};

// Every member's standing from the services and check-ins on record. Members
// of a location that hasn't recorded a Sunday yet are left "unknown".
export function summarise(
  members: { id: string; churchId: string }[],
  services: ServiceLite[],
  attendance: AttendanceRow[],
  today: string
): Map<string, MemberAttendance> {
  const attendedBy = new Map<string, Set<string>>();
  for (const a of attendance) {
    const set = attendedBy.get(a.memberId) ?? new Set<string>();
    set.add(a.serviceId);
    attendedBy.set(a.memberId, set);
  }
  const dateOf = new Map(services.map((s) => [s.id, s.date]));
  const sundaysByChurch = new Map<string, ServiceLite[]>();

  const out = new Map<string, MemberAttendance>();
  for (const m of members) {
    let sundays = sundaysByChurch.get(m.churchId);
    if (!sundays) {
      sundays = sundayServicesFor(services, m.churchId, today);
      sundaysByChurch.set(m.churchId, sundays);
    }
    const attended = attendedBy.get(m.id) ?? new Set<string>();
    const lastAttended = [...attended].map((id) => dateOf.get(id)).filter((d): d is string => !!d).sort().at(-1);
    out.set(m.id, {
      memberId: m.id,
      status: attendanceStatus(sundays, attended, today),
      missedInARow: sundays.length === 0 ? 0 : consecutiveMissedSundays(sundays, attended),
      lastAttended,
    });
  }
  return out;
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { ServiceLite } from "@/lib/attendance/rules";
import type { AttendanceRow } from "@/lib/attendance/summary";
import { tenant } from "@/tenant";

export type ServiceRow = ServiceLite & { name: string; attendees: number; firstTimers: number };
export type FollowUp = { id: string; memberId: string; createdAt: string; outcome: string; note?: string };

// Today's date where the church is, as YYYY-MM-DD.
export function churchToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tenant.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Services and check-ins of the last `weeks` weeks, as far as the viewer's
// RLS allows (a cell leader sees only their cell's check-ins).
export async function getAttendanceData(weeks = 12, client?: SupabaseClient<Database>) {
  const supabase = client ?? (await createClient());
  const since = new Date(Date.now() - weeks * 7 * 86_400_000).toISOString().slice(0, 10);
  const { data: services, error } = await supabase
    .from("services")
    .select("id, church_id, service_date, kind, name")
    .gte("service_date", since)
    .order("service_date", { ascending: false });
  if (error) return { available: false as const, services: [] as ServiceRow[], attendance: [] as AttendanceRow[], followUps: [] as FollowUp[] };

  const ids = (services ?? []).map((s) => s.id);
  const attendance: { service_id: string; member_id: string }[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from("attendance").select("service_id, member_id").in("service_id", ids.slice(i, i + 100)).limit(20000);
    attendance.push(...(data ?? []));
  }
  const { data: visitors } = ids.length
    ? await supabase.from("members").select("id, join_date").eq("is_visitor", true).gte("join_date", since)
    : { data: [] };
  const visitorJoined = new Map((visitors ?? []).map((v) => [v.id, v.join_date]));

  const { data: followUps } = await supabase
    .from("follow_ups")
    .select("id, member_id, created_at, outcome, note")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  return {
    available: true as const,
    services: (services ?? []).map((s) => {
      const rows = attendance.filter((a) => a.service_id === s.id);
      return {
        id: s.id,
        churchId: s.church_id,
        date: s.service_date,
        kind: s.kind,
        name: s.name,
        attendees: rows.length,
        firstTimers: rows.filter((a) => visitorJoined.get(a.member_id) === s.service_date).length,
      };
    }),
    attendance: attendance.map((a) => ({ serviceId: a.service_id, memberId: a.member_id })),
    followUps: (followUps ?? []).map((f) => ({
      id: f.id,
      memberId: f.member_id,
      createdAt: f.created_at,
      outcome: f.outcome,
      note: f.note ?? undefined,
    })),
  };
}

export function serviceTitle(s: { kind: string; name: string }): string {
  if (s.name) return s.name;
  return s.kind === "sunday" ? "Sunday service" : s.kind === "midweek" ? "Midweek service" : "Special service";
}

// One member's record: their location's recent services, which they came to,
// and the follow-ups recorded for them.
export async function getMemberAttendance(memberId: string, churchId: string, weeks = 12) {
  const supabase = await createClient();
  const since = new Date(Date.now() - weeks * 7 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: services }, { data: attended }, { data: followUps }] = await Promise.all([
    supabase.from("services").select("id, church_id, service_date, kind, name").eq("church_id", churchId).gte("service_date", since),
    supabase.from("attendance").select("service_id").eq("member_id", memberId),
    supabase.from("follow_ups").select("id, member_id, created_at, outcome, note").eq("member_id", memberId).order("created_at", { ascending: false }).limit(10),
  ]);
  return {
    services: (services ?? []).map((s) => ({ id: s.id, churchId: s.church_id, date: s.service_date, kind: s.kind, name: s.name })),
    attended: new Set((attended ?? []).map((a) => a.service_id)),
    followUps: (followUps ?? []).map((f) => ({ id: f.id, memberId: f.member_id, createdAt: f.created_at, outcome: f.outcome, note: f.note ?? undefined })),
  };
}

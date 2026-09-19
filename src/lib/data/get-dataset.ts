import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Dataset } from "./analytics";
import type {
  ActivityItem,
  ActivityType,
  CalendarEvent,
  CalendarEventType,
  Church,
  Country,
  LedgerEntry,
  LedgerEntryType,
  LessonStatus,
  Member,
  MemberRole,
  Reconciliation,
  TrainingProgram,
} from "./types";

export type CurrentProfile = {
  userId: string;
  zoneId: string;
  zoneName: string;
  zoneCurrency: string;
  setupComplete: boolean;
  role: "super_admin" | "admin" | "member";
  fullName: string;
  email: string;
  hiddenNavItems: string[];
  linkedMemberId: string | null;
};

// Returns null when there's no logged-in user, or a profile row doesn't
// (yet) exist for them — callers decide what to do (usually redirect).
// Wrapped in React's cache() so the layout's check and a page's own check
// within the same request share one DB round trip instead of two.
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("zone_id, role, full_name, email, hidden_nav_items, zones(name, setup_complete, display_currency)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const zone = Array.isArray(profile.zones) ? profile.zones[0] : profile.zones;
  if (!zone) return null;

  let linkedMemberId: string | null = null;
  if (profile.role === "member") {
    const { data: member } = await supabase.from("members").select("id").eq("profile_id", user.id).maybeSingle();
    linkedMemberId = member?.id ?? null;
  }

  return {
    userId: user.id,
    zoneId: profile.zone_id,
    zoneName: zone.name,
    zoneCurrency: zone.display_currency,
    setupComplete: zone.setup_complete,
    role: profile.role as CurrentProfile["role"],
    fullName: profile.full_name,
    email: profile.email,
    hiddenNavItems: profile.hidden_nav_items ?? [],
    linkedMemberId,
  };
});

type MemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  church_id: string;
  country_id: string;
  join_date: string;
  role: string;
  avatar_color: string;
  profile_id: string | null;
  title: string | null;
  kc_handle: string | null;
  profession: string | null;
  spouse_name: string | null;
  birthday: string | null;
  wedding_anniversary: string | null;
  giving_entries: { month: string; amount: number }[] | null;
  trainings:
    | {
        id: string;
        status: string;
        assigned_at: string;
        completed_at: string | null;
        training_programs: {
          id: string;
          name: string;
          description: string | null;
          video_url: string | null;
          icon: string;
          points: number;
        } | null;
      }[]
    | null;
};

// PostgREST caps any unpaginated select at its project's default max-rows
// setting (1000) — a zone with more members than that would otherwise have
// every dashboard/reports view silently truncated with no error. Page
// through with .range() until a page comes back short.
async function fetchAllMembers(supabase: SupabaseClient<Database>, zoneId: string): Promise<MemberRow[]> {
  const pageSize = 1000;
  const all: MemberRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("members")
      .select(
        "*, giving_entries(month, amount), trainings(id, status, assigned_at, completed_at, training_programs(id, name, description, video_url, icon, points))"
      )
      .eq("zone_id", zoneId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...((data as unknown as MemberRow[]) ?? []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

export async function getZoneDataset(zoneId: string): Promise<Dataset & { zoneName: string }> {
  const supabase = await createClient();

  const [zoneRes, countriesRes, churchesRes, memberRows, activityRes, eventsRes, programsRes] = await Promise.all([
    supabase.from("zones").select("name").eq("id", zoneId).single(),
    supabase.from("countries").select("*").eq("zone_id", zoneId),
    supabase.from("churches").select("*").eq("zone_id", zoneId),
    fetchAllMembers(supabase, zoneId),
    supabase.from("activity").select("*").eq("zone_id", zoneId).order("timestamp", { ascending: false }),
    supabase.from("events").select("*").eq("zone_id", zoneId),
    supabase.from("training_programs").select("*").eq("zone_id", zoneId).order("created_at", { ascending: true }),
  ]);

  const countries: Country[] = (countriesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    flag: c.flag,
  }));

  const churches: Church[] = (churchesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    countryId: c.country_id,
    city: c.city ?? undefined,
    foundedYear: c.founded_year ?? undefined,
    pastor: c.pastor ?? undefined,
  }));

  const members: Member[] = memberRows.map((m) => ({
    id: m.id,
    firstName: m.first_name,
    lastName: m.last_name,
    email: m.email ?? "",
    phone: m.phone ?? "",
    churchId: m.church_id,
    countryId: m.country_id,
    joinDate: m.join_date,
    role: m.role as MemberRole,
    avatarColor: m.avatar_color,
    giving: (m.giving_entries ?? []).map((g) => ({ month: g.month, amount: Number(g.amount) })),
    trainings: (m.trainings ?? [])
      .filter((t) => t.training_programs !== null)
      .map((t) => ({
        id: t.id,
        programId: t.training_programs!.id,
        name: t.training_programs!.name,
        description: t.training_programs!.description ?? undefined,
        videoUrl: t.training_programs!.video_url ?? undefined,
        icon: t.training_programs!.icon,
        points: t.training_programs!.points,
        status: t.status as LessonStatus,
        assignedAt: t.assigned_at,
        completedAt: t.completed_at ?? undefined,
      })),
    hasPortalAccess: m.profile_id != null,
    title: m.title ?? undefined,
    kcHandle: m.kc_handle ?? undefined,
    profession: m.profession ?? undefined,
    spouseName: m.spouse_name ?? undefined,
    birthday: m.birthday ?? undefined,
    weddingAnniversary: m.wedding_anniversary ?? undefined,
  }));

  const activity: ActivityItem[] = (activityRes.data ?? []).map((a) => ({
    id: a.id,
    type: a.type as ActivityType,
    message: a.message,
    churchId: a.church_id ?? "",
    timestamp: a.timestamp,
  }));

  const events: CalendarEvent[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    time: e.time,
    type: e.type as CalendarEventType,
    churchId: e.church_id ?? undefined,
    countryId: e.country_id ?? undefined,
  }));

  const trainingPrograms: TrainingProgram[] = (programsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    videoUrl: p.video_url ?? undefined,
    icon: p.icon,
    points: p.points,
  }));

  return {
    zoneName: zoneRes.data?.name ?? "Zone",
    countries,
    churches,
    members,
    activity,
    events,
    trainingPrograms,
  };
}

export async function getLedgerEntries(zoneId: string): Promise<LedgerEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ledger_entries")
    .select("*")
    .eq("zone_id", zoneId)
    .order("entry_date", { ascending: false });

  return (data ?? []).map((e) => ({
    id: e.id,
    churchId: e.church_id,
    type: e.type as LedgerEntryType,
    category: e.category,
    description: e.description ?? undefined,
    amount: Number(e.amount),
    entryDate: e.entry_date,
  }));
}

export async function getReconciliations(zoneId: string): Promise<Reconciliation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reconciliations")
    .select("*, profiles(full_name)")
    .eq("zone_id", zoneId)
    .order("period_end", { ascending: false });

  return (data ?? []).map((r) => {
    const reconciler = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id,
      churchId: r.church_id,
      periodEnd: r.period_end,
      actualBalance: Number(r.actual_balance),
      calculatedBalance: Number(r.calculated_balance),
      variance: Number(r.variance),
      notes: r.notes ?? undefined,
      reconciledByName: reconciler?.full_name ?? undefined,
      createdAt: r.created_at,
    };
  });
}

export type AuditLogEntry = {
  id: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
};

export async function getAuditLog(zoneId: string, limit = 50): Promise<AuditLogEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("*")
    .eq("zone_id", zoneId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((a) => ({
    id: a.id,
    actorName: a.actor_name,
    action: a.action,
    summary: a.summary,
    createdAt: a.created_at,
  }));
}

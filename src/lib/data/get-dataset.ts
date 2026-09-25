import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { Dataset } from "./analytics";
import { isGivingCategory } from "@/lib/giving";
import { mapEventRow } from "./events";
import { CAPABILITIES, hasCapability, isPortfolio, isPosition, type Capability, type Portfolio, type Position, type Scope } from "@/lib/access";
import type {
  ActivityItem,
  ActivityType,
  CalendarEvent,
  GivingAggregate,
  Church,
  Country,
  LedgerEntry,
  LedgerEntryType,
  LessonStatus,
  Member,
  MemberRole,
  Reconciliation,
  SubZone,
  TrainingProgram,
} from "./types";

export type CurrentProfile = {
  userId: string;
  zoneId: string;
  zoneName: string;
  zoneCurrency: string;
  setupComplete: boolean;
  role: "super_admin" | "admin" | "member";
  position: Position;
  portfolio: Portfolio | null;
  scope: Scope;
  subZoneId: string | null;
  churchId: string | null;
  // Effective capabilities, already including any per-person grants/revokes.
  caps: string[];
  fullName: string;
  email: string;
  hiddenNavItems: string[];
  linkedMemberId: string | null;
};

// Returns null when there's no logged-in user, or a profile row doesn't
// (yet) exist for them — callers decide what to do (usually redirect).
// Wrapped in React's cache() so the layout's check and a page's own check
// within the same request share one DB round trip instead of two.
export function can(profile: Pick<CurrentProfile, "caps">, cap: Capability): boolean {
  return hasCapability(profile.caps, cap);
}

export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "zone_id, role, full_name, email, hidden_nav_items, position, portfolio, scope, sub_zone_id, church_id, caps, zones(name, setup_complete, display_currency)"
    )
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const zone = Array.isArray(profile.zones) ? profile.zones[0] : profile.zones;
  if (!zone) return null;

  // Directors hold every capability by definition. Their stored list is a
  // snapshot, so a permission added after their login was created (e.g. editing
  // event pages) would be missing — and RLS reads the stored list. Heal it on
  // the spot instead of making someone press "Refresh permissions".
  let caps: string[] = profile.caps ?? [];
  if (
    (profile.position === "zonal_director" || profile.position === "assistant_zonal_director") &&
    CAPABILITIES.some((c) => !caps.includes(c))
  ) {
    caps = [...CAPABILITIES];
    await createAdminClient().from("profiles").update({ caps }).eq("id", user.id);
  }

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
    position: isPosition(profile.position) ? profile.position : "member",
    portfolio: isPortfolio(profile.portfolio) ? profile.portfolio : null,
    scope: profile.scope,
    subZoneId: profile.sub_zone_id,
    churchId: profile.church_id,
    caps,
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
  join_date: string | null;
  role: string;
  position: string;
  portfolio: string | null;
  avatar_color: string;
  profile_id: string | null;
  title: string | null;
  kc_handle: string | null;
  profession: string | null;
  spouse_name: string | null;
  birthday: string | null;
  wedding_anniversary: string | null;
  photo_url: string | null;
  giving_entries: { month: string; amount: number; category: string | null }[] | null;
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
        "*, giving_entries(month, amount, category), trainings(id, status, assigned_at, completed_at, training_programs(id, name, description, video_url, icon, points))"
      )
      .eq("zone_id", zoneId)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...((data as unknown as MemberRow[]) ?? []));
    if (!data || data.length < pageSize) break;
  }
  return all;
}

// Same 1000-row PostgREST cap as members — a long history across ~85
// chapters and four categories can exceed it.
async function fetchGivingTotals(supabase: SupabaseClient<Database>): Promise<GivingAggregate[]> {
  const pageSize = 1000;
  const all: GivingAggregate[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.rpc("giving_totals_in_scope").range(from, from + pageSize - 1);
    if (error) throw error;
    for (const g of data ?? []) {
      all.push({
        churchId: g.church_id,
        month: g.month,
        category: isGivingCategory(g.category) ? g.category : undefined,
        amount: Number(g.amount),
      });
    }
    if (!data || data.length < pageSize) break;
  }
  return all;
}

export async function getZoneDataset(zoneId: string): Promise<Dataset & { zoneName: string }> {
  const supabase = await createClient();
  const viewer = await getCurrentProfile();
  const canSeeContacts = !!viewer && can(viewer, "view_contact_details");

  const [
    zoneRes,
    countriesRes,
    churchesRes,
    subZonesRes,
    memberRows,
    activityRes,
    eventsRes,
    programsRes,
    giving,
  ] = await Promise.all([
    supabase.from("zones").select("name").eq("id", zoneId).single(),
    supabase.from("countries").select("*").eq("zone_id", zoneId),
    supabase.from("churches").select("*").eq("zone_id", zoneId),
    supabase.from("sub_zones").select("*").eq("zone_id", zoneId),
    fetchAllMembers(supabase, zoneId),
    supabase.from("activity").select("*").eq("zone_id", zoneId).order("timestamp", { ascending: false }),
    supabase.from("events").select("*").eq("zone_id", zoneId),
    supabase.from("training_programs").select("*").eq("zone_id", zoneId).order("created_at", { ascending: true }),
    fetchGivingTotals(supabase),
  ]);

  const churches: Church[] = (churchesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    countryId: c.country_id,
    city: c.city ?? undefined,
    foundedYear: c.founded_year ?? undefined,
    pastor: c.pastor ?? undefined,
    subZoneId: c.sub_zone_id ?? undefined,
    isOffice: c.is_office || undefined,
  }));

  // A leader scoped to one sub-zone or chapter shouldn't see the rest of the
  // zone's countries as empty shells — only those with a visible chapter.
  const visibleCountryIds = new Set(churches.map((c) => c.countryId));
  const countries: Country[] = (countriesRes.data ?? [])
    .filter((c) => viewer?.scope === "zone" || visibleCountryIds.has(c.id))
    .map((c) => ({ id: c.id, name: c.name, flag: c.flag }));

  const subZones: SubZone[] = (subZonesRes.data ?? []).map((z) => ({ id: z.id, name: z.name }));

  const members: Member[] = memberRows.map((m) => ({
    id: m.id,
    firstName: m.first_name,
    lastName: m.last_name,
    // Contact details stay on the server for leaders who may not see them
    // (a member always sees their own row).
    email: (canSeeContacts || m.profile_id === viewer?.userId ? m.email : null) ?? "",
    phone: (canSeeContacts || m.profile_id === viewer?.userId ? m.phone : null) ?? "",
    churchId: m.church_id,
    countryId: m.country_id,
    joinDate: m.join_date ?? undefined,
    role: m.role as MemberRole,
    position: isPosition(m.position) ? m.position : "member",
    portfolio: isPortfolio(m.portfolio) ? m.portfolio : undefined,
    avatarColor: m.avatar_color,
    giving: (m.giving_entries ?? []).map((g) => ({
      month: g.month,
      amount: Number(g.amount),
      category: isGivingCategory(g.category) ? g.category : undefined,
    })),
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
    profileId: m.profile_id ?? undefined,
    title: m.title ?? undefined,
    ...(canSeeContacts || m.profile_id === viewer?.userId
      ? {
          kcHandle: m.kc_handle ?? undefined,
          profession: m.profession ?? undefined,
          spouseName: m.spouse_name ?? undefined,
          birthday: m.birthday ?? undefined,
          weddingAnniversary: m.wedding_anniversary ?? undefined,
        }
      : {}),
    photoUrl: m.photo_url ?? undefined,
  }));

  const activity: ActivityItem[] = (activityRes.data ?? []).map((a) => ({
    id: a.id,
    type: a.type as ActivityType,
    message: a.message,
    churchId: a.church_id ?? "",
    timestamp: a.timestamp,
  }));

  const events: CalendarEvent[] = (eventsRes.data ?? []).map(mapEventRow);

  const trainingPrograms: TrainingProgram[] = (programsRes.data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    videoUrl: p.video_url ?? undefined,
    icon: p.icon,
    points: p.points,
    assignToNewMembers: p.assign_to_new_members,
  }));

  return {
    zoneName: zoneRes.data?.name ?? "Zone",
    countries,
    churches,
    members,
    activity,
    events,
    trainingPrograms,
    subZones,
    giving,
    individualGiving: !!viewer && (viewer.role === "member" || can(viewer, "view_giving_individual")),
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

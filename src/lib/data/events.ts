import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EVENT_SERIES_DEFS } from "@/lib/event-series";
import type { Database } from "@/lib/supabase/types";
import type { CalendarEvent, EventMedia, EventSeries } from "./types";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export function mapEventRow(e: EventRow): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    date: e.date,
    time: e.time,
    type: e.type,
    churchId: e.church_id ?? undefined,
    countryId: e.country_id ?? undefined,
    description: e.description ?? undefined,
    endDate: e.end_date ?? undefined,
    location: e.location ?? undefined,
    coverUrl: e.cover_url ?? undefined,
    seriesId: e.series_id ?? undefined,
  };
}

// The five flagship series exist for every zone. Seeded here (service-role,
// idempotent) so a zone set up before this feature — or whose setup skipped
// it — still gets them the first time anyone opens an events page.
export async function ensureEventSeries(zoneId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: existing } = await admin.from("event_series").select("slug").eq("zone_id", zoneId);
  const have = new Set((existing ?? []).map((s) => s.slug));
  const missing = EVENT_SERIES_DEFS.map((def, i) => ({ def, i })).filter(({ def }) => !have.has(def.slug));
  if (missing.length === 0) return;
  await admin
    .from("event_series")
    .upsert(
      missing.map(({ def, i }) => ({ zone_id: zoneId, slug: def.slug, name: def.name, sort_order: i })),
      { onConflict: "zone_id,slug", ignoreDuplicates: true }
    );
}

function mapSeries(s: Database["public"]["Tables"]["event_series"]["Row"]): EventSeries {
  return { id: s.id, slug: s.slug, name: s.name, description: s.description ?? undefined };
}

export async function getEventSeriesList(zoneId: string): Promise<EventSeries[]> {
  await ensureEventSeries(zoneId);
  const supabase = await createClient();
  const { data } = await supabase.from("event_series").select("*").eq("zone_id", zoneId).order("sort_order");
  return (data ?? []).map(mapSeries);
}

export async function getEventSeriesBySlug(zoneId: string, slug: string): Promise<EventSeries | null> {
  await ensureEventSeries(zoneId);
  const supabase = await createClient();
  const { data } = await supabase.from("event_series").select("*").eq("zone_id", zoneId).eq("slug", slug).maybeSingle();
  return data ? mapSeries(data) : null;
}

// Newest first. "Latest" is simply the first one — upcoming editions count.
export async function getSeriesEditions(zoneId: string, seriesId: string): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("zone_id", zoneId)
    .eq("series_id", seriesId)
    .order("date", { ascending: false });
  return (data ?? []).map(mapEventRow);
}

// The latest edition of every series in one query, plus how many editions each has.
export async function getLatestEditionsBySeries(
  zoneId: string
): Promise<Map<string, { latest: CalendarEvent; count: number }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("*")
    .eq("zone_id", zoneId)
    .not("series_id", "is", null)
    .order("date", { ascending: false });
  const bySeries = new Map<string, { latest: CalendarEvent; count: number }>();
  for (const row of data ?? []) {
    const seriesId = row.series_id!;
    const existing = bySeries.get(seriesId);
    if (existing) existing.count++;
    else bySeries.set(seriesId, { latest: mapEventRow(row), count: 1 });
  }
  return bySeries;
}

export async function getEventById(eventId: string): Promise<CalendarEvent | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("id", eventId).maybeSingle();
  return data ? mapEventRow(data) : null;
}

export async function getEventMedia(eventId: string): Promise<EventMedia[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_media")
    .select("*")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("created_at");
  return (data ?? []).map((m) => ({
    id: m.id,
    eventId: m.event_id,
    kind: m.kind,
    url: m.url,
    title: m.title ?? undefined,
  }));
}

export async function getSeriesById(seriesId: string): Promise<EventSeries | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("event_series").select("*").eq("id", seriesId).maybeSingle();
  return data ? mapSeries(data) : null;
}

// Whether the signed-in user may edit this event's page — the same
// can_edit_event() the database enforces, so the button never lies.
export async function canEditEventPage(event: CalendarEvent): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_edit_event", {
    e_series: event.seriesId ?? null,
    e_church: event.churchId ?? null,
  });
  return data === true;
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getCurrentProfile, type CurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import { checkUpload, EVENT_MEDIA_BUCKET } from "@/lib/event-media";
import type { EventMediaKind } from "@/lib/supabase/types";
import type { ActionResult } from "./members";

type EventFields = {
  title: string;
  date: string;
  endDate?: string;
  location?: string;
  description?: string;
};

function refreshEventPages(eventId?: string) {
  revalidatePath("/events", "layout");
  revalidatePath("/calendar");
  revalidatePath("/me/calendar");
  revalidatePath("/dashboard");
  if (eventId) revalidatePath(`/event/${eventId}`);
}

// Whether the caller may edit this event's page. Asked of the database
// itself (can_edit_event) so it can never disagree with the RLS policies
// that actually gate the writes.
async function canEditEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string
): Promise<{ ok: true; zoneId: string; title: string } | { ok: false; error: string }> {
  const { data: event } = await supabase
    .from("events")
    .select("zone_id, title, series_id, church_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { ok: false, error: "Event not found." };
  const { data: allowed } = await supabase.rpc("can_edit_event", { e_series: event.series_id, e_church: event.church_id });
  if (!allowed) return { ok: false, error: "Not permitted." };
  return { ok: true, zoneId: event.zone_id, title: event.title };
}

async function requireStaff(): Promise<{ ok: true; profile: CurrentProfile } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role === "member") return { ok: false, error: "Not permitted." };
  return { ok: true, profile };
}

function validDate(d: string | undefined): boolean {
  return !!d && !Number.isNaN(Date.parse(d));
}

export type CreateEditionResult = { ok: true; eventId: string } | { ok: false; error: string };

// A new yearly edition of one of the five flagship events. It's just an event
// on the calendar that points at its series.
export async function createSeriesEdition(seriesId: string, fields: EventFields): Promise<CreateEditionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return staff;
  const { profile } = staff;
  if (!can(profile, "manage_events")) return { ok: false, error: "Not permitted." };
  if (!fields.title.trim() || !validDate(fields.date)) return { ok: false, error: "A title and a start date are required." };
  if (fields.endDate && (!validDate(fields.endDate) || fields.endDate < fields.date)) {
    return { ok: false, error: "The end date can't be before the start date." };
  }

  const supabase = await createClient();
  const { data: series } = await supabase.from("event_series").select("id, name").eq("id", seriesId).maybeSingle();
  if (!series) return { ok: false, error: "That event series doesn't exist." };

  const { data, error } = await supabase
    .from("events")
    .insert({
      zone_id: profile.zoneId,
      title: fields.title.trim(),
      date: fields.date,
      end_date: fields.endDate || null,
      time: "All day",
      type: "flagship",
      location: fields.location?.trim() || null,
      description: fields.description?.trim() || null,
      series_id: seriesId,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the edition." };

  await logAudit(profile, "event.create", `Added "${fields.title.trim()}" to ${series.name}`);
  refreshEventPages(data.id);
  return { ok: true, eventId: data.id };
}

export async function updateEventPage(eventId: string, fields: EventFields): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return staff;
  const { profile } = staff;
  if (!fields.title.trim() || !validDate(fields.date)) return { ok: false, error: "A title and a start date are required." };
  if (fields.endDate && (!validDate(fields.endDate) || fields.endDate < fields.date)) {
    return { ok: false, error: "The end date can't be before the start date." };
  }

  const supabase = await createClient();
  const check = await canEditEvent(supabase, eventId);
  if (!check.ok) return check;

  const { error } = await supabase
    .from("events")
    .update({
      title: fields.title.trim(),
      date: fields.date,
      end_date: fields.endDate || null,
      location: fields.location?.trim() || null,
      description: fields.description?.trim() || null,
    })
    .eq("id", eventId);
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "event.update", `Edited the page for "${fields.title.trim()}"`);
  refreshEventPages(eventId);
  return { ok: true };
}

export async function updateSeriesPage(
  seriesId: string,
  fields: { name: string; description?: string }
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return staff;
  const { profile } = staff;
  if (!can(profile, "manage_events")) return { ok: false, error: "Not permitted." };
  if (!fields.name.trim()) return { ok: false, error: "A name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_series")
    .update({ name: fields.name.trim(), description: fields.description?.trim() || null })
    .eq("id", seriesId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "That event series doesn't exist." };

  await logAudit(profile, "event.series_update", `Edited the "${fields.name.trim()}" page`);
  refreshEventPages();
  return { ok: true };
}

// Removes an event and its uploaded pictures/files (best-effort on storage —
// the database rows are what matter and they cascade).
export async function deleteEventPage(eventId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return staff;
  const { profile } = staff;

  const supabase = await createClient();
  const check = await canEditEvent(supabase, eventId);
  if (!check.ok) return check;

  const { data: media } = await supabase.from("event_media").select("storage_path").eq("event_id", eventId);
  const { data: event } = await supabase.from("events").select("cover_path").eq("id", eventId).maybeSingle();

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return { ok: false, error: error.message };

  const paths = [...(media ?? []).map((m) => m.storage_path), event?.cover_path].filter((p): p is string => !!p);
  if (paths.length > 0) await createAdminClient().storage.from(EVENT_MEDIA_BUCKET).remove(paths);

  await logAudit(profile, "event.delete", `Deleted the event "${check.title}"`);
  refreshEventPages();
  return { ok: true };
}

export type UploadTokenResult =
  | { ok: true; path: string; token: string }
  | { ok: false; error: string };

// Step 1 of an upload: check the caller may edit this event and the file is
// acceptable, then hand back a short-lived signed URL token. The browser
// uploads straight to storage (bypassing Next's 1 MB server-action limit) and
// then calls addEventMedia / setEventCover to record it.
export async function createUploadToken(
  eventId: string,
  file: { name: string; type: string; size: number; kind: "image" | "file" }
): Promise<UploadTokenResult> {
  const staff = await requireStaff();
  if (!staff.ok) return staff;

  const problem = checkUpload(file.kind, file.type, file.size);
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const check = await canEditEvent(supabase, eventId);
  if (!check.ok) return check;

  const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  const path = `${check.zoneId}/${eventId}/${crypto.randomUUID()}-${safeName}`;
  const { data, error } = await createAdminClient().storage.from(EVENT_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not start the upload." };
  return { ok: true, path, token: data.token };
}

function publicUrl(path: string): string {
  return createAdminClient().storage.from(EVENT_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

// A path is only accepted if it sits under this event's own folder, so a
// caller can't attach some other event's file.
function pathBelongsTo(path: string, zoneId: string, eventId: string): boolean {
  return path.startsWith(`${zoneId}/${eventId}/`) && !path.includes("..");
}

export async function addEventMedia(
  eventId: string,
  media:
    | { kind: "image" | "file"; path: string; title?: string }
    | { kind: "video"; url: string; title?: string }
): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return staff;
  const { profile } = staff;

  const supabase = await createClient();
  const check = await canEditEvent(supabase, eventId);
  if (!check.ok) return check;

  let url: string;
  let storagePath: string | null = null;
  if (media.kind === "video") {
    try {
      const parsed = new URL(media.url.trim());
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("bad protocol");
      url = parsed.toString();
    } catch {
      return { ok: false, error: "Enter a valid video link, e.g. a YouTube or Vimeo URL." };
    }
  } else {
    if (!pathBelongsTo(media.path, check.zoneId, eventId)) return { ok: false, error: "That upload doesn't belong to this event." };
    storagePath = media.path;
    url = publicUrl(media.path);
  }

  const { data: last } = await supabase
    .from("event_media")
    .select("sort_order")
    .eq("event_id", eventId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("event_media").insert({
    event_id: eventId,
    zone_id: check.zoneId,
    kind: media.kind as EventMediaKind,
    url,
    storage_path: storagePath,
    title: media.title?.trim() || null,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "event.media_add", `Added a ${media.kind} to "${check.title}"`);
  refreshEventPages(eventId);
  return { ok: true };
}

export async function setEventCover(eventId: string, path: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return staff;
  const { profile } = staff;

  const supabase = await createClient();
  const check = await canEditEvent(supabase, eventId);
  if (!check.ok) return check;
  if (!pathBelongsTo(path, check.zoneId, eventId)) return { ok: false, error: "That upload doesn't belong to this event." };

  const { data: existing } = await supabase.from("events").select("cover_path").eq("id", eventId).maybeSingle();
  const { error } = await supabase
    .from("events")
    .update({ cover_url: publicUrl(path), cover_path: path })
    .eq("id", eventId);
  if (error) return { ok: false, error: error.message };

  if (existing?.cover_path && existing.cover_path !== path) {
    await createAdminClient().storage.from(EVENT_MEDIA_BUCKET).remove([existing.cover_path]);
  }
  await logAudit(profile, "event.cover", `Changed the cover picture for "${check.title}"`);
  refreshEventPages(eventId);
  return { ok: true };
}

export async function removeEventCover(eventId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return staff;

  const supabase = await createClient();
  const check = await canEditEvent(supabase, eventId);
  if (!check.ok) return check;

  const { data: existing } = await supabase.from("events").select("cover_path").eq("id", eventId).maybeSingle();
  const { error } = await supabase.from("events").update({ cover_url: null, cover_path: null }).eq("id", eventId);
  if (error) return { ok: false, error: error.message };
  if (existing?.cover_path) await createAdminClient().storage.from(EVENT_MEDIA_BUCKET).remove([existing.cover_path]);

  refreshEventPages(eventId);
  return { ok: true };
}

export async function removeEventMedia(mediaId: string): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.ok) return staff;
  const { profile } = staff;

  const supabase = await createClient();
  const { data: media } = await supabase
    .from("event_media")
    .select("event_id, storage_path, kind")
    .eq("id", mediaId)
    .maybeSingle();
  if (!media) return { ok: false, error: "That item no longer exists." };

  const check = await canEditEvent(supabase, media.event_id);
  if (!check.ok) return check;

  const { error } = await supabase.from("event_media").delete().eq("id", mediaId);
  if (error) return { ok: false, error: error.message };
  if (media.storage_path) await createAdminClient().storage.from(EVENT_MEDIA_BUCKET).remove([media.storage_path]);

  await logAudit(profile, "event.media_remove", `Removed a ${media.kind} from "${check.title}"`);
  refreshEventPages(media.event_id);
  return { ok: true };
}

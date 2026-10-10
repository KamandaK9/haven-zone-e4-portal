"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";
import { labels, lower } from "@/lib/labels";
import { tenant } from "@/tenant";
import { can } from "@/lib/data/get-dataset";
import { flagForCountry } from "@/lib/country-flags";

// The structure is for the Directors and anyone they give manage_settings
// (can_change_structure in the database says the same); this checks up front
// for a clearer error.
async function requireDirector() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (profile.role !== "super_admin" && !can(profile, "manage_settings")) {
    return { ok: false as const, error: "Only the Directors (or whoever they let manage settings) can change the structure." };
  }
  return { ok: true as const, profile, supabase: await createClient() };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function checkDates(startedOn: string | null, endedOn: string | null): string | null {
  if ((startedOn && !ISO.test(startedOn)) || (endedOn && !ISO.test(endedOn))) return "Use full dates.";
  if (startedOn && endedOn && endedOn < startedOn) return "The end date is before the start date.";
  return null;
}

export async function createSubZone(name: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await requireDirector();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) return { ok: false, error: "Give it a name (up to 80 characters)." };
  const { data, error } = await supabase.from("sub_zones").insert({ zone_id: profile.zoneId, name: trimmed }).select("id").single();
  if (error?.code === "23505") return { ok: false, error: `There's already a ${lower(labels.subZone)} called "${trimmed}".` };
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't add it." };
  await logAudit(profile, "sub_zone.create", `Added the ${lower(labels.subZone)} "${trimmed}"`, { entity: { type: "sub_zone", id: data.id } });
  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

export async function updateSubZone(
  subZoneId: string,
  input: { name: string; foundedYear: number | null; history: string }
): Promise<ActionResult> {
  const auth = await requireDirector();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const name = input.name.trim();
  const history = input.history.trim();
  if (!name || name.length > 80) return { ok: false, error: "Give it a name (up to 80 characters)." };
  if (history.length > 10000) return { ok: false, error: "Keep the history under 10,000 characters." };
  if (input.foundedYear !== null && (!Number.isInteger(input.foundedYear) || input.foundedYear < 1900 || input.foundedYear > 2100)) {
    return { ok: false, error: "That year doesn't look right." };
  }
  const { data, error } = await supabase
    .from("sub_zones")
    .update({ name, founded_year: input.foundedYear, history: history || null })
    .eq("id", subZoneId)
    .eq("zone_id", profile.zoneId)
    .select("id");
  if (error?.code === "23505") return { ok: false, error: `There's already a ${lower(labels.subZone)} called "${name}".` };
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Couldn't save — apply the latest database migration and try again." };
  await logAudit(profile, "sub_zone.update", `Edited the ${lower(labels.subZone)} "${name}"`, { entity: { type: "sub_zone", id: subZoneId } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// Moves a location into a sub-zone (or out of any, with null). Its current
// leaders' history moves with it (database trigger).
export async function moveChapterToSubZone(churchId: string, subZoneId: string | null): Promise<ActionResult> {
  const auth = await requireDirector();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const { data: church } = await supabase.from("churches").select("name").eq("id", churchId).maybeSingle();
  const { error } = await supabase.rpc("set_church_sub_zone", { p_church: churchId, p_sub_zone: subZoneId });
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "church.move", `Moved ${church?.name ?? `a ${lower(labels.location)}`} ${subZoneId ? `to another ${lower(labels.subZone)}` : `out of its ${lower(labels.subZone)}`}`, {
    entity: { type: "church", id: churchId },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

// A leader from before the portal kept records.
export async function addPastLeader(
  subZoneId: string,
  input: { name: string; startedOn: string | null; endedOn: string | null }
): Promise<ActionResult> {
  const auth = await requireDirector();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const position = tenant.access.groupLeaderPositionKey;
  if (!position) return { ok: false, error: "This organisation has no sub-zone leader position set up." };
  const name = input.name.trim();
  if (!name || name.length > 200) return { ok: false, error: "Enter their name." };
  if (!input.endedOn) return { ok: false, error: "Add when they finished — the current leader is recorded automatically." };
  const problem = checkDates(input.startedOn, input.endedOn);
  if (problem) return { ok: false, error: problem };
  const { error } = await supabase.from("position_history").insert({
    zone_id: profile.zoneId,
    member_name: name,
    position,
    sub_zone_id: subZoneId,
    started_on: input.startedOn,
    ended_on: input.endedOn,
    manual: true,
  });
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "sub_zone.leader_history", `Added ${name} to a ${lower(labels.subZone)}'s past leaders`, {
    entity: { type: "sub_zone", id: subZoneId },
  });
  revalidatePath(`/sub-zones/${subZoneId}`);
  return { ok: true };
}

// Corrects a history entry's dates (and, for one added by hand, the name).
export async function updateLeaderEntry(
  entryId: string,
  input: { name?: string; startedOn: string | null; endedOn: string | null }
): Promise<ActionResult> {
  const auth = await requireDirector();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const problem = checkDates(input.startedOn, input.endedOn);
  if (problem) return { ok: false, error: problem };
  const { data: entry } = await supabase.from("position_history").select("manual, member_name, sub_zone_id").eq("id", entryId).maybeSingle();
  if (!entry) return { ok: false, error: "That entry no longer exists." };
  const name = entry.manual && input.name?.trim() ? input.name.trim().slice(0, 200) : entry.member_name;
  const { error } = await supabase
    .from("position_history")
    .update({ member_name: name, started_on: input.startedOn, ended_on: input.endedOn })
    .eq("id", entryId);
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "sub_zone.leader_history", `Corrected ${name}'s dates as a leader`, { entity: { type: "sub_zone", id: entry.sub_zone_id ?? "" } });
  if (entry.sub_zone_id) revalidatePath(`/sub-zones/${entry.sub_zone_id}`);
  return { ok: true };
}

// Only entries added by hand can be removed; automatic ones are corrected.
export async function deleteLeaderEntry(entryId: string): Promise<ActionResult> {
  const auth = await requireDirector();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const { data, error } = await supabase
    .from("position_history")
    .delete()
    .eq("id", entryId)
    .eq("manual", true)
    .select("member_name, sub_zone_id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Only entries added by hand can be removed." };
  await logAudit(profile, "sub_zone.leader_history", `Removed ${data[0].member_name} from a ${lower(labels.subZone)}'s past leaders`, {
    entity: { type: "sub_zone", id: data[0].sub_zone_id ?? "" },
  });
  if (data[0].sub_zone_id) revalidatePath(`/sub-zones/${data[0].sub_zone_id}`);
  return { ok: true };
}

// A location filed under the wrong country; its members move with it.
export async function setChapterCountry(churchId: string, countryId: string): Promise<ActionResult> {
  const auth = await requireDirector();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const [{ data: church }, { data: country }] = await Promise.all([
    supabase.from("churches").select("name").eq("id", churchId).maybeSingle(),
    supabase.from("countries").select("name").eq("id", countryId).maybeSingle(),
  ]);
  const { error } = await supabase.rpc("set_church_country", { p_church: churchId, p_country: countryId });
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "church.move", `Moved ${church?.name ?? `a ${lower(labels.location)}`} to ${country?.name ?? "another country"}`, {
    entity: { type: "church", id: churchId },
  });
  revalidatePath("/", "layout");
  return { ok: true };
}

// A country that wasn't in the list yet.
export async function addCountry(name: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const auth = await requireDirector();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) return { ok: false, error: "Enter the country's name." };
  const { data: existing } = await supabase.from("countries").select("id").eq("zone_id", profile.zoneId).ilike("name", trimmed);
  if (existing?.length) return { ok: false, error: `${trimmed} is already in the list.` };
  const { data, error } = await supabase
    .from("countries")
    .insert({ zone_id: profile.zoneId, name: trimmed, flag: flagForCountry(trimmed) })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't add it." };
  await logAudit(profile, "country.create", `Added the country ${trimmed}`);
  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

// Two locations that are really one: everything moves to `intoId`, and
// `fromId` is removed. Can't be undone.
export async function mergeChapters(fromId: string, intoId: string): Promise<{ ok: true; moved: number } | { ok: false; error: string }> {
  const auth = await requireDirector();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const { data: names } = await supabase.from("churches").select("id, name").in("id", [fromId, intoId]);
  const from = names?.find((n) => n.id === fromId)?.name;
  const into = names?.find((n) => n.id === intoId)?.name;
  const { data, error } = await supabase.rpc("merge_churches", { p_from: fromId, p_into: intoId });
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "church.merge", `Merged ${from ?? `a ${lower(labels.location)}`} into ${into ?? `another ${lower(labels.location)}`} (${data} members moved)`, {
    entity: { type: "church", id: intoId },
    before: { mergedFrom: fromId, name: from },
  });
  revalidatePath("/", "layout");
  return { ok: true, moved: data ?? 0 };
}

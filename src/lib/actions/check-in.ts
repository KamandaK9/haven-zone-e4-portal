"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import { serviceKeyString, type QueuedCheckIn, type Roster, type ServiceKey, type SyncResult } from "@/lib/check-in/types";
import { tenant } from "@/tenant";
import { getSiteUrl } from "@/lib/site-url";

// Check-in's server side. Everything here is safe to call again with the same
// input: services are unique on location/date/kind/name, a first-timer's
// member id and every attendance id come from the device, and a member is
// checked in to a service at most once.

async function checkInProfile() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, signedOut: true, error: "Signed out — sign in again to sync." };
  if (!can(profile, "check_in")) return { ok: false as const, signedOut: false, error: "You can't check people in." };
  return { ok: true as const, profile };
}

// The location's member list for check-in: names, cells and age groups only.
export async function getCheckInRoster(churchId: string): Promise<{ ok: true; roster: Roster } | { ok: false; error: string }> {
  const auth = await checkInProfile();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("checkin_roster", { p_church_id: churchId });
  if (error) return { ok: false, error: error.message };
  const groupLabel = (key: string | null) => tenant.ageGroups?.find((g) => g.key === key)?.label;
  return {
    ok: true,
    roster: {
      churchId,
      savedAt: new Date().toISOString(),
      members: (data ?? [])
        .map((m) => ({
          id: m.id,
          name: `${m.first_name} ${m.last_name}`.trim(),
          cell: m.cell_name ?? undefined,
          ageGroup: groupLabel(m.age_group),
          isVisitor: m.is_visitor,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}

// Who is already checked in to a service (from any device).
export async function getServiceCheckIns(key: ServiceKey): Promise<string[]> {
  const auth = await checkInProfile();
  if (!auth.ok) return [];
  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("id")
    .match({ church_id: key.churchId, service_date: key.date, kind: key.kind, name: key.name })
    .maybeSingle();
  if (!service) return [];
  const { data } = await supabase.from("attendance").select("member_id").eq("service_id", service.id);
  return (data ?? []).map((a) => a.member_id);
}

async function ensureService(supabase: Awaited<ReturnType<typeof createClient>>, zoneId: string, userId: string, key: ServiceKey) {
  const match = { church_id: key.churchId, service_date: key.date, kind: key.kind, name: key.name };
  const { data: existing } = await supabase.from("services").select("id").match(match).maybeSingle();
  if (existing) return { id: existing.id };
  const { error } = await supabase
    .from("services")
    .upsert({ ...match, zone_id: zoneId, created_by: userId }, { onConflict: "church_id,service_date,kind,name", ignoreDuplicates: true });
  if (error) return { error: error.message };
  const { data } = await supabase.from("services").select("id").match(match).maybeSingle();
  return data ? { id: data.id } : { error: "Couldn't open that service." };
}

export async function syncCheckIns(items: QueuedCheckIn[]): Promise<SyncResult> {
  const auth = await checkInProfile();
  if (!auth.ok) return auth;
  const { profile } = auth;
  const supabase = await createClient();

  const synced: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const byService = new Map<string, QueuedCheckIn[]>();
  for (const item of items) {
    const k = serviceKeyString(item.service);
    byService.set(k, [...(byService.get(k) ?? []), item]);
  }

  for (const group of byService.values()) {
    const service = await ensureService(supabase, profile.zoneId, profile.userId, group[0].service);
    if ("error" in service) {
      for (const item of group) failed.push({ id: item.id, error: service.error ?? "Couldn't open that service." });
      continue;
    }

    const ready: QueuedCheckIn[] = [];
    for (const item of group) {
      if (!item.visitor) {
        ready.push(item);
        continue;
      }
      const { error } = await supabase.rpc("checkin_add_visitor", {
        p_id: item.memberId,
        p_church_id: item.service.churchId,
        p_first_name: item.visitor.firstName,
        p_last_name: item.visitor.lastName,
        p_phone: item.visitor.phone,
      });
      if (error) failed.push({ id: item.id, error: error.message });
      else ready.push(item);
    }

    const row = (item: QueuedCheckIn) => ({
      id: item.id,
      zone_id: profile.zoneId,
      service_id: service.id,
      member_id: item.memberId,
      checked_in_at: item.checkedInAt,
      checked_in_by: profile.userId,
      device_id: item.deviceId,
    });
    const { error } = await supabase
      .from("attendance")
      .upsert(ready.map(row), { onConflict: "service_id,member_id", ignoreDuplicates: true });
    if (!error) {
      synced.push(...ready.map((i) => i.id));
      continue;
    }
    // One bad row fails the batch — retry one by one so the rest still land.
    for (const item of ready) {
      const { error: one } = await supabase
        .from("attendance")
        .upsert(row(item), { onConflict: "service_id,member_id", ignoreDuplicates: true });
      if (one) failed.push({ id: item.id, error: one.message });
      else synced.push(item.id);
    }
  }

  if (synced.length > 0) {
    await logAudit(profile, "attendance.sync", `${synced.length} check-in${synced.length === 1 ? "" : "s"} synced`);
    revalidatePath("/attendance");
  }
  return { ok: true, synced, failed };
}

// Undoing a check-in that has already reached the server.
export async function undoCheckIn(key: ServiceKey, memberId: string): Promise<{ ok: boolean; error?: string }> {
  const auth = await checkInProfile();
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = await createClient();
  const { data: service } = await supabase
    .from("services")
    .select("id")
    .match({ church_id: key.churchId, service_date: key.date, kind: key.kind, name: key.name })
    .maybeSingle();
  if (!service) return { ok: true };
  const { error } = await supabase.from("attendance").delete().match({ service_id: service.id, member_id: memberId });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// The QR code for a service: a link anyone can open on their phone to check
// themselves in (src/app/c/[token]). One per service, made on first ask, and
// it stops working the day after the service.
export async function getCheckInLink(key: ServiceKey): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const auth = await checkInProfile();
  if (!auth.ok) return { ok: false, error: auth.error };
  const supabase = await createClient();
  const match = { church_id: key.churchId, service_date: key.date, kind: key.kind, name: key.name };
  let { data: link } = await supabase.from("check_in_links").select("token").match(match).maybeSingle();
  if (!link) {
    const token = randomBytes(18).toString("base64url");
    const expires = new Date(new Date(`${key.date}T00:00:00Z`).getTime() + 36 * 3_600_000); // through the next morning
    const { error } = await supabase
      .from("check_in_links")
      .insert({ ...match, token, zone_id: auth.profile.zoneId, created_by: auth.profile.userId, expires_at: expires.toISOString() });
    if (error) {
      // Made at the same moment by another device — use theirs.
      ({ data: link } = await supabase.from("check_in_links").select("token").match(match).maybeSingle());
      if (!link) return { ok: false, error: error.message };
    } else link = { token };
  }
  return { ok: true, url: `${await getSiteUrl()}/c/${link.token}` };
}

// Called every few minutes while a check-in screen is open, so the tablet at
// the door isn't signed out for inactivity during the sermon (the proxy's
// idle sign-out counts requests). Only check-in screens call it.
export async function checkInStillOpen(): Promise<boolean> {
  const profile = await getCurrentProfile();
  return !!profile && can(profile, "check_in");
}

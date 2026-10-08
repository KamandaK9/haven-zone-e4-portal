"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { dispatchMessage } from "@/lib/messaging/dispatch";
import { smsIsConfigured } from "@/lib/messaging/twilio";
import { smsSegments, toE164 } from "@/lib/messaging/text";
import { tenant } from "@/tenant";
import { nextAgeGroup } from "@/lib/children/graduation";
import { createPrivateUpload, pathIsUnder, removeFiles } from "@/lib/storage/private-files";
import { RESOURCES_BUCKET } from "@/lib/resources/bucket";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";
import type { ServiceKey } from "@/lib/check-in/types";

// Children's church check-in. Staff check a child in with their guardian's
// details; a 4-digit code is made (and texted to the guardian if texts are
// connected); the child is only released against that code — or, if it's
// lost, with a reason that's kept.

const AGE_GROUPS = [...(tenant.childrenCheckIn?.ageGroups ?? ["children"])];

async function staff() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!can(profile, "check_in")) return { ok: false as const, error: "You can't check children in." };
  return { ok: true as const, profile, supabase: await createClient() };
}

export async function getChildren(churchId: string) {
  const profile = await getCurrentProfile();
  if (!profile || !(can(profile, "check_in") || can(profile, "manage_children"))) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("children_roster", { p_church_id: churchId, p_age_groups: AGE_GROUPS });
  return (data ?? [])
    .map((c) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`.trim(),
      guardianName: c.guardian_name ?? "",
      guardianPhone: c.guardian_phone ?? "",
      birthday: c.birthday ?? "",
      expectedGraduation: c.expected_graduation ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Lesson materials ──────────────────────────────────────────────────
// Files for the teachers, kept as resources of kind "children". Whoever runs
// children's church (manage_children) adds and removes them; any leader
// reads them.

async function head() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!can(profile, "manage_children")) return { ok: false as const, error: "Only the head of children's church can change the materials." };
  return { ok: true as const, profile };
}

const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;

export async function createMaterialUpload(file: { name: string; size: number }) {
  const auth = await head();
  if (!auth.ok) return auth;
  if (file.size > MAX_MATERIAL_BYTES) return { ok: false as const, error: "That file is over 50 MB." };
  return createPrivateUpload(RESOURCES_BUCKET, auth.profile.zoneId, file.name);
}

export async function saveMaterial(input: {
  title: string;
  description?: string;
  lessonDate?: string;
  // Either an uploaded file or a link (a video, Google Slides…).
  file?: { path: string; fileName: string; mime: string; bytes: number };
  link?: string;
}): Promise<ActionResult> {
  const auth = await head();
  if (!auth.ok) return auth;
  const { profile } = auth;
  if (!input.title.trim()) return { ok: false, error: "Give it a title." };
  let link: string | null = null;
  if (input.link?.trim()) {
    try {
      const u = new URL(input.link.trim());
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
      link = u.toString();
    } catch {
      return { ok: false, error: "That link doesn't look right — it should start with https://" };
    }
  }
  if (!input.file && !link) return { ok: false, error: "Add a file or a link." };
  if (input.file && !pathIsUnder(input.file.path, profile.zoneId)) return { ok: false, error: "That upload isn't yours." };
  const supabase = await createClient();
  const { error } = await supabase.from("resources").insert({
    zone_id: profile.zoneId,
    kind: "children",
    title: input.title.trim(),
    description: input.description?.trim() || null,
    lesson_date: input.lessonDate && /^\d{4}-\d{2}-\d{2}$/.test(input.lessonDate) ? input.lessonDate : null,
    file_path: input.file?.path ?? null,
    file_name: input.file?.fileName ?? null,
    mime: input.file?.mime ?? null,
    bytes: input.file?.bytes ?? 0,
    link_url: link,
    uploaded_by: profile.userId,
  });
  if (error) {
    if (input.file) await removeFiles(RESOURCES_BUCKET, [input.file.path]);
    return { ok: false, error: error.message };
  }
  await logAudit(profile, "children.material_add", `Added "${input.title.trim()}" to children's church materials`);
  revalidatePath("/children");
  return { ok: true };
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  const auth = await head();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data, error } = await supabase.from("resources").delete().eq("id", id).eq("kind", "children").select("file_path, title");
  if (error) return { ok: false, error: error.message };
  if (data?.[0]) {
    if (data[0].file_path) await removeFiles(RESOURCES_BUCKET, [data[0].file_path]);
    await logAudit(auth.profile, "children.material_remove", `Removed "${data[0].title}" from children's church materials`);
  }
  revalidatePath("/children");
  return { ok: true };
}

// ── Graduation ────────────────────────────────────────────────────────

export async function setGraduation(childId: string, month: string | null): Promise<ActionResult> {
  const auth = await head();
  if (!auth.ok) return auth;
  if (month && !/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: "Pick a month." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_child_graduation", { p_member: childId, p_month: month ? `${month}-01` : null });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "You can't change that child." };
  revalidatePath("/children");
  return { ok: true };
}

export async function graduateChild(childId: string, churchId: string): Promise<ActionResult> {
  const auth = await head();
  if (!auth.ok) return auth;
  const supabase = await createClient();
  const { data: child } = await supabase.rpc("children_roster", { p_church_id: churchId, p_age_groups: AGE_GROUPS });
  const found = (child ?? []).find((c) => c.id === childId);
  if (!found || !found.age_group) return { ok: false, error: "That child isn't in children's church." };
  const next = nextAgeGroup(tenant.ageGroups ?? [], found.age_group);
  if (!next) return { ok: false, error: "There's no age group to move them into." };
  const { data, error } = await supabase.rpc("graduate_child", { p_member: childId, p_to: next.key });
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "You can't change that child." };
  await logAudit(auth.profile, "children.graduate", `${found.first_name} ${found.last_name} moved up to ${next.label}`);
  revalidatePath("/children");
  return { ok: true };
}

async function serviceFor(supabase: Awaited<ReturnType<typeof createClient>>, zoneId: string, userId: string, key: ServiceKey) {
  const match = { church_id: key.churchId, service_date: key.date, kind: key.kind, name: key.name };
  const { data: existing } = await supabase.from("services").select("id").match(match).maybeSingle();
  if (existing) return existing.id;
  await supabase.from("services").upsert({ ...match, zone_id: zoneId, created_by: userId }, { onConflict: "church_id,service_date,kind,name", ignoreDuplicates: true });
  const { data } = await supabase.from("services").select("id").match(match).maybeSingle();
  return data?.id;
}

export async function checkInChild(input: {
  service: ServiceKey;
  childId: string;
  childName: string;
  guardianName: string;
  guardianPhone: string;
  notes: string;
  textCode: boolean;
}): Promise<(ActionResult & { code?: string; texted?: boolean; note?: string }) | { ok: false; error: string }> {
  const auth = await staff();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  if (!input.guardianName.trim()) return { ok: false, error: "Who's the guardian collecting them?" };
  const serviceId = await serviceFor(supabase, profile.zoneId, profile.userId, input.service);
  if (!serviceId) return { ok: false, error: "Couldn't open that service." };

  // A code nobody else in this service is holding.
  const { data: open } = await supabase.from("child_checkins").select("pickup_code").eq("service_id", serviceId).is("checked_out_at", null);
  const used = new Set((open ?? []).map((c) => c.pickup_code));
  let code = "";
  for (let i = 0; i < 50 && (!code || used.has(code)); i++) code = String(randomInt(0, 10000)).padStart(4, "0");

  const phone = input.guardianPhone.trim();
  const { error } = await supabase.from("child_checkins").insert({
    zone_id: profile.zoneId,
    service_id: serviceId,
    child_id: input.childId,
    child_name: input.childName,
    guardian_name: input.guardianName.trim(),
    guardian_phone: phone || null,
    pickup_code: code,
    notes: input.notes.trim() || null,
    checked_in_by: profile.userId,
  });
  if (error) return { ok: false, error: error.message.includes("duplicate") ? "They're already checked in to this service." : error.message };

  // It counts as their attendance at the service too.
  await supabase.from("attendance").upsert(
    { id: crypto.randomUUID(), zone_id: profile.zoneId, service_id: serviceId, member_id: input.childId, checked_in_by: profile.userId, device_id: "children" },
    { onConflict: "service_id,member_id", ignoreDuplicates: true }
  );

  // Keep the guardian's details on the child's record if there were none.
  const admin = createAdminClient();
  const { data: member } = await admin.from("members").select("guardian_name, guardian_phone").eq("id", input.childId).maybeSingle();
  if (member && (!member.guardian_name || !member.guardian_phone)) {
    await admin
      .from("members")
      .update({ guardian_name: member.guardian_name || input.guardianName.trim(), guardian_phone: member.guardian_phone || phone || null })
      .eq("id", input.childId);
  }

  let texted = false;
  let note: string | undefined;
  const to = toE164(phone, tenant.messaging?.countryCode);
  if (input.textCode && to) {
    if (!smsIsConfigured()) {
      note = "Texts aren't connected, so the code wasn't sent — tell the guardian the code.";
    } else {
      const body = `Hi ${input.guardianName.trim().split(" ")[0]}, ${input.childName.split(" ")[0]} is checked in at Children's Church. Pick-up code: ${code}. Please show this when you collect them. — ${tenant.name}`;
      const { data: message } = await admin
        .from("messages")
        .insert({ zone_id: profile.zoneId, kind: "pickup", channel: "sms", body, status: "approved", created_by: profile.userId, created_by_name: profile.fullName, approved_by_name: "Automatic", approved_at: new Date().toISOString() })
        .select("id")
        .single();
      if (message) {
        await admin.from("message_recipients").insert({
          message_id: message.id, zone_id: profile.zoneId, member_id: input.childId, channel: "sms", name: input.guardianName.trim(),
          to_address: to, via: "guardian", body, segments: smsSegments(body).segments,
        });
        const result = await dispatchMessage(message.id);
        texted = result.ok;
        if (!result.ok) note = `The code couldn't be texted (${result.error}) — tell the guardian the code.`;
      }
    }
  }
  await logAudit(profile, "children.check_in", "Checked a child in to children's church", { entity: { type: "member", id: input.childId } });
  revalidatePath("/children");
  return { ok: true, code, texted, note };
}

export async function releaseChild(checkinId: string, code: string, reason?: string): Promise<ActionResult> {
  const auth = await staff();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;
  const { data: row } = await supabase.from("child_checkins").select("id, child_id, child_name, pickup_code, checked_out_at").eq("id", checkinId).maybeSingle();
  if (!row) return { ok: false, error: "That check-in isn't yours to release." };
  if (row.checked_out_at) return { ok: false, error: "They've already been collected." };

  const withCode = code.trim() === row.pickup_code;
  if (!withCode && !(reason && reason.trim().length >= 5)) {
    return { ok: false, error: code.trim() ? "That isn't the right code." : "Enter the pick-up code — or give a reason if it's lost." };
  }
  const { error } = await supabase
    .from("child_checkins")
    .update({ checked_out_at: new Date().toISOString(), checked_out_by: profile.userId, override_reason: withCode ? null : reason!.trim() })
    .eq("id", checkinId);
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, withCode ? "children.release" : "children.release_override", withCode ? "Released a child to their guardian" : `Released a child without the code: ${reason!.trim()}`, {
    entity: { type: "member", id: row.child_id },
  });
  revalidatePath("/children");
  return { ok: true };
}

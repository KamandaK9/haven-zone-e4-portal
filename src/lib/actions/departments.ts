"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

async function settingsAdmin() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not signed in." };
  if (!can(profile, "manage_settings")) return { ok: false as const, error: "Only admins can change departments." };
  return { ok: true as const, profile, supabase: await createClient() };
}

const done = (): ActionResult => {
  revalidatePath("/", "layout");
  return { ok: true };
};

export async function addDepartments(names: string[]): Promise<ActionResult> {
  const auth = await settingsAdmin();
  if (!auth.ok) return auth;
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (clean.length === 0) return { ok: false, error: "Give it a name." };
  const { data: existing } = await auth.supabase.from("departments").select("name, sort_order");
  const taken = new Set((existing ?? []).map((d) => d.name.toLowerCase()));
  const start = Math.max(0, ...(existing ?? []).map((d) => d.sort_order)) + 1;
  const rows = clean.filter((n) => !taken.has(n.toLowerCase())).map((name, i) => ({ zone_id: auth.profile.zoneId, name, sort_order: start + i }));
  if (rows.length === 0) return { ok: false, error: "That department already exists." };
  const { error } = await auth.supabase.from("departments").insert(rows);
  if (error) return { ok: false, error: error.message };
  await logAudit(auth.profile, "settings.departments", `Added ${rows.map((r) => r.name).join(", ")}`);
  return done();
}

export async function renameDepartment(id: string, name: string): Promise<ActionResult> {
  const auth = await settingsAdmin();
  if (!auth.ok) return auth;
  if (!name.trim()) return { ok: false, error: "Give it a name." };
  const { error } = await auth.supabase.from("departments").update({ name: name.trim() }).eq("id", id);
  return error ? { ok: false, error: error.message.includes("unique") ? "That department already exists." : error.message } : done();
}

export async function removeDepartment(id: string): Promise<ActionResult> {
  const auth = await settingsAdmin();
  if (!auth.ok) return auth;
  const { data, error } = await auth.supabase.from("departments").delete().eq("id", id).select("name");
  if (error) return { ok: false, error: error.message };
  if (data?.[0]) await logAudit(auth.profile, "settings.departments", `Removed ${data[0].name}`);
  return done();
}

export async function moveDepartment(id: string, direction: -1 | 1): Promise<ActionResult> {
  const auth = await settingsAdmin();
  if (!auth.ok) return auth;
  const { data } = await auth.supabase.from("departments").select("id, sort_order, name").order("sort_order").order("name");
  const list = data ?? [];
  const i = list.findIndex((d) => d.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true };
  [list[i], list[j]] = [list[j], list[i]];
  for (const [k, d] of list.entries()) await auth.supabase.from("departments").update({ sort_order: k }).eq("id", d.id);
  return done();
}

// Which departments a member serves in (replaces the whole set).
export async function setMemberDepartments(memberId: string, departmentIds: string[]): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_members")) return { ok: false, error: "Not permitted." };
  const supabase = await createClient();
  const { error: delError } = await supabase.from("member_departments").delete().eq("member_id", memberId);
  if (delError) return { ok: false, error: delError.message };
  if (departmentIds.length > 0) {
    const { error } = await supabase
      .from("member_departments")
      .insert([...new Set(departmentIds)].map((department_id) => ({ member_id: memberId, department_id, zone_id: profile.zoneId })));
    if (error) return { ok: false, error: error.message };
  }
  await logAudit(profile, "member.departments", "Changed a member's departments", { entity: { type: "member", id: memberId } });
  revalidatePath(`/members/${memberId}`);
  return { ok: true };
}

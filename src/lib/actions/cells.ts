"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile, type CurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

export type CellInput = {
  name: string;
  parentId?: string | null;
  leaderMemberId?: string | null;
  meetingDay?: string;
  meetingPlace?: string;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireManager(): Promise<{ ok: true; profile: CurrentProfile; supabase: Supabase } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_members")) return { ok: false, error: "Not permitted." };
  return { ok: true, profile, supabase: await createClient() };
}

// Structure rules the database can't express on its own: a parent must be a
// top-level group in the same chapter, and a leader must belong to the chapter.
async function checkInput(supabase: Supabase, churchId: string, input: CellInput, selfId?: string): Promise<string | null> {
  if (!input.name.trim()) return "Give it a name.";
  if (input.parentId) {
    if (input.parentId === selfId) return "A group can't sit inside itself.";
    const { data: parent } = await supabase.from("cells").select("church_id, parent_id").eq("id", input.parentId).maybeSingle();
    if (!parent || parent.church_id !== churchId) return "That group isn't in this chapter.";
    if (parent.parent_id) return "Cells can only sit one level deep.";
    if (selfId) {
      const { count } = await supabase.from("cells").select("id", { count: "exact", head: true }).eq("parent_id", selfId);
      if (count) return "This group has cells of its own, so it can't move inside another group.";
    }
  }
  if (input.leaderMemberId) {
    const { data: leader } = await supabase.from("members").select("church_id").eq("id", input.leaderMemberId).maybeSingle();
    if (!leader || leader.church_id !== churchId) return "The leader must be a member of this chapter.";
  }
  return null;
}

function fields(input: CellInput) {
  return {
    name: input.name.trim(),
    parent_id: input.parentId || null,
    leader_member_id: input.leaderMemberId || null,
    meeting_day: input.meetingDay?.trim() || null,
    meeting_place: input.meetingPlace?.trim() || null,
  };
}

export async function createCell(churchId: string, input: CellInput): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;

  const problem = await checkInput(supabase, churchId, input);
  if (problem) return { ok: false, error: problem };

  const { error } = await supabase.from("cells").insert({ zone_id: profile.zoneId, church_id: churchId, ...fields(input) });
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "cell.create", `Added "${input.name.trim()}"`);
  revalidatePath(`/churches/${churchId}`);
  return { ok: true };
}

export async function updateCell(cellId: string, input: CellInput): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;

  const { data: cell } = await supabase.from("cells").select("church_id").eq("id", cellId).maybeSingle();
  if (!cell) return { ok: false, error: "That group no longer exists." };
  const problem = await checkInput(supabase, cell.church_id, input, cellId);
  if (problem) return { ok: false, error: problem };

  const { error } = await supabase.from("cells").update(fields(input)).eq("id", cellId);
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "cell.update", `Edited "${input.name.trim()}"`);
  revalidatePath(`/churches/${cell.church_id}`);
  return { ok: true };
}

// Deleting a group deletes its cells too (cascade); their members simply
// become unassigned.
export async function deleteCell(cellId: string): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;

  const { data: cell } = await supabase.from("cells").select("church_id, name").eq("id", cellId).maybeSingle();
  if (!cell) return { ok: false, error: "That group no longer exists." };
  const { error } = await supabase.from("cells").delete().eq("id", cellId);
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "cell.delete", `Removed "${cell.name}"`);
  revalidatePath(`/churches/${cell.church_id}`);
  return { ok: true };
}

// Makes `memberIds` exactly the members of this cell: they move in (from
// wherever they were), and anyone else currently in it becomes unassigned.
export async function setCellMembers(cellId: string, memberIds: string[]): Promise<ActionResult> {
  const auth = await requireManager();
  if (!auth.ok) return auth;
  const { profile, supabase } = auth;

  const { data: cell } = await supabase.from("cells").select("church_id, name").eq("id", cellId).maybeSingle();
  if (!cell) return { ok: false, error: "That group no longer exists." };

  const ids = [...new Set(memberIds)];
  if (ids.length > 0) {
    const { data: rows } = await supabase.from("members").select("id, church_id").in("id", ids);
    if ((rows ?? []).length !== ids.length || rows!.some((r) => r.church_id !== cell.church_id)) {
      return { ok: false, error: "Only members of this chapter can be added." };
    }
    const { error } = await supabase.from("members").update({ cell_id: cellId }).in("id", ids);
    if (error) return { ok: false, error: error.message };
  }

  let clear = supabase.from("members").update({ cell_id: null }).eq("cell_id", cellId);
  if (ids.length > 0) clear = clear.not("id", "in", `(${ids.join(",")})`);
  const { error } = await clear;
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "cell.members", `Set the members of "${cell.name}" (${ids.length})`);
  revalidatePath(`/churches/${cell.church_id}`);
  return { ok: true };
}

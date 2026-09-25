"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import { TRAINING_ICON_OPTIONS } from "@/lib/training-icons";
import type { ActionResult } from "./members";

export type CreateTrainingProgramInput = {
  name: string;
  description?: string;
  videoUrl?: string;
  icon: string;
  points: number;
  assignToNewMembers?: boolean;
};

export async function createTrainingProgram(input: CreateTrainingProgramInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_training")) return { ok: false, error: "Not permitted." };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name is required." };
  const icon = TRAINING_ICON_OPTIONS.includes(input.icon) ? input.icon : "BookOpen";
  const points = Number.isFinite(input.points) && input.points >= 0 ? Math.round(input.points) : 10;

  const supabase = await createClient();
  const { error } = await supabase.from("training_programs").insert({
    zone_id: profile.zoneId,
    name,
    description: input.description?.trim() || null,
    video_url: input.videoUrl?.trim() || null,
    icon,
    points,
    assign_to_new_members: input.assignToNewMembers === true,
    created_by: profile.userId,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "training_program.create", `Created training program "${name}"`);
  revalidatePath("/training");
  return { ok: true };
}

function cleanProgramFields(input: CreateTrainingProgramInput) {
  return {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    video_url: input.videoUrl?.trim() || null,
    icon: TRAINING_ICON_OPTIONS.includes(input.icon) ? input.icon : "BookOpen",
    points: Number.isFinite(input.points) && input.points >= 0 ? Math.round(input.points) : 10,
    assign_to_new_members: input.assignToNewMembers === true,
  };
}

// Points are read from the program at display time, so changing them here
// changes everyone's leaderboard total retroactively — the edit dialog says so.
export async function updateTrainingProgram(programId: string, input: CreateTrainingProgramInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_training")) return { ok: false, error: "Not permitted." };

  const fields = cleanProgramFields(input);
  if (!fields.name) return { ok: false, error: "Name is required." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("training_programs")
    .update(fields)
    .eq("id", programId)
    .eq("zone_id", profile.zoneId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Program not found, or you don't have access to it." };

  await logAudit(profile, "training_program.update", `Edited training program "${fields.name}"`);
  revalidatePath("/training");
  revalidatePath("/dashboard");
  revalidatePath("/me");
  revalidatePath("/me/training");
  return { ok: true };
}

// Deleting a program deletes every member's progress on it (trainings
// cascades), so it can't be undone.
export async function deleteTrainingProgram(programId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_training")) return { ok: false, error: "Not permitted." };

  const supabase = await createClient();
  const { data: program } = await supabase
    .from("training_programs")
    .select("name")
    .eq("id", programId)
    .eq("zone_id", profile.zoneId)
    .maybeSingle();
  if (!program) return { ok: false, error: "Program not found, or you don't have access to it." };

  const { error } = await supabase.from("training_programs").delete().eq("id", programId).eq("zone_id", profile.zoneId);
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "training_program.delete", `Deleted training program "${program.name}"`);
  revalidatePath("/training");
  revalidatePath("/dashboard");
  revalidatePath("/me");
  revalidatePath("/me/training");
  return { ok: true };
}

export type AssignTrainingScope =
  | { type: "zone" }
  | { type: "country"; countryId: string }
  | { type: "church"; churchId: string };

// `alreadyHad` = people in the chosen group who were skipped because they
// already have this program.
export type AssignTrainingResult =
  | { ok: true; assigned: number; alreadyHad: number }
  | { ok: false; error: string };

export async function assignTraining(programId: string, scope: AssignTrainingScope): Promise<AssignTrainingResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_training")) return { ok: false, error: "Not permitted." };

  const supabase = await createClient();

  let query = supabase.from("members").select("id").eq("zone_id", profile.zoneId);
  if (scope.type === "country") query = query.eq("country_id", scope.countryId);
  if (scope.type === "church") query = query.eq("church_id", scope.churchId);
  const { data: members, error: membersError } = await query;
  if (membersError) return { ok: false, error: membersError.message };
  if (!members || members.length === 0) return { ok: true, assigned: 0, alreadyHad: 0 };

  // Skip anyone already assigned. (Done here rather than with an upsert: the
  // unique index on (member, program) is partial, and Postgres can't use a
  // partial index as an ON CONFLICT target — that was the "no unique or
  // exclusion constraint matching the ON CONFLICT specification" error.)
  const alreadyAssigned = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: existing, error: existingError } = await supabase
      .from("trainings")
      .select("member_id")
      .eq("program_id", programId)
      .range(from, from + pageSize - 1);
    if (existingError) return { ok: false, error: existingError.message };
    for (const row of existing ?? []) alreadyAssigned.add(row.member_id);
    if (!existing || existing.length < pageSize) break;
  }

  const rows = members
    .filter((m) => !alreadyAssigned.has(m.id))
    .map((m) => ({
      member_id: m.id,
      zone_id: profile.zoneId,
      program_id: programId,
      status: "not_started" as const,
      assigned_by: profile.userId,
    }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from("trainings").insert(rows.slice(i, i + 500));
    if (error) return { ok: false, error: error.message };
  }

  await logAudit(profile, "training.assign", `Assigned a training program to ${rows.length} member(s)`);
  revalidatePath("/training");
  revalidatePath("/dashboard");
  return { ok: true, assigned: rows.length, alreadyHad: members.length - rows.length };
}

export async function updateTrainingStatus(trainingId: string, status: "in_progress" | "completed"): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trainings")
    .update({ status, completed_at: status === "completed" ? new Date().toISOString() : null })
    .eq("id", trainingId)
    .select("id, member_id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Training not found, or you don't have access to it." };

  // Staff acting on someone else's training is the only case worth an
  // audit entry — a member updating their own row is routine self-service
  // and audit_log's insert policy doesn't permit member writes anyway.
  if (profile.role !== "member") {
    await logAudit(profile, "training.update_status", `Marked a training "${status}" for a member`);
  }

  revalidatePath("/training");
  revalidatePath(`/members/${data.member_id}`);
  revalidatePath("/me");
  revalidatePath("/me/training");
  return { ok: true };
}

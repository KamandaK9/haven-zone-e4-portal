"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { logAudit } from "./audit";
import { TRAINING_ICON_OPTIONS } from "@/lib/training-icons";
import type { ActionResult } from "./members";

export type CreateTrainingProgramInput = {
  name: string;
  description?: string;
  videoUrl?: string;
  icon: string;
  points: number;
};

export async function createTrainingProgram(input: CreateTrainingProgramInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role === "member") return { ok: false, error: "Not permitted." };

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
    created_by: profile.userId,
  });
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "training_program.create", `Created training program "${name}"`);
  revalidatePath("/training");
  return { ok: true };
}

export type AssignTrainingScope =
  | { type: "zone" }
  | { type: "country"; countryId: string }
  | { type: "church"; churchId: string };

export type AssignTrainingResult = { ok: true; assigned: number } | { ok: false; error: string };

export async function assignTraining(programId: string, scope: AssignTrainingScope): Promise<AssignTrainingResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role === "member") return { ok: false, error: "Not permitted." };

  const supabase = await createClient();

  let query = supabase.from("members").select("id").eq("zone_id", profile.zoneId);
  if (scope.type === "country") query = query.eq("country_id", scope.countryId);
  if (scope.type === "church") query = query.eq("church_id", scope.churchId);
  const { data: members, error: membersError } = await query;
  if (membersError) return { ok: false, error: membersError.message };
  if (!members || members.length === 0) return { ok: true, assigned: 0 };

  const rows = members.map((m) => ({
    member_id: m.id,
    zone_id: profile.zoneId,
    program_id: programId,
    status: "not_started" as const,
    assigned_by: profile.userId,
  }));

  const { error } = await supabase
    .from("trainings")
    .upsert(rows, { onConflict: "member_id,program_id", ignoreDuplicates: true });
  if (error) return { ok: false, error: error.message };

  await logAudit(profile, "training.assign", `Assigned a training program to ${members.length} member(s)`);
  revalidatePath("/training");
  revalidatePath("/dashboard");
  return { ok: true, assigned: members.length };
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
  return { ok: true };
}

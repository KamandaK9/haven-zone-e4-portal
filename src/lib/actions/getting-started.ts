"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import type { ActionResult } from "./members";

type State = { dismissed?: boolean; done?: string[] };

async function update(change: (s: State) => State): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_access")) return { ok: false, error: "Not permitted." };
  const supabase = await createClient();
  const { data } = await supabase.from("zones").select("getting_started").eq("id", profile.zoneId).single();
  const next = change((data?.getting_started as State | null) ?? {});
  const { error } = await supabase.from("zones").update({ getting_started: next }).eq("id", profile.zoneId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function markStepDone(key: string): Promise<ActionResult> {
  return update((s) => ({ ...s, done: [...new Set([...(s.done ?? []), key])] }));
}

export async function dismissGettingStarted(): Promise<ActionResult> {
  return update((s) => ({ ...s, dismissed: true }));
}

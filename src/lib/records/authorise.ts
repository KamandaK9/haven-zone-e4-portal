import "server-only";
import { createClient } from "@/lib/supabase/server";
import { can, getCurrentProfile, type CurrentProfile } from "@/lib/data/get-dataset";
import type { ChapterRecordKind } from "@/lib/supabase/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// What a paperwork upload is for: one of the register kinds, or a cheque stub.
export type RecordUploadPurpose = ChapterRecordKind | "cheque";

function capabilityFor(purpose: RecordUploadPurpose) {
  return purpose === "bank_advice" || purpose === "cheque" ? "manage_ledger" : "manage_records";
}

// The permission and scope check every records action starts with. Churches
// RLS only returns chapters in the caller's scope, so finding the chapter
// proves they may work in it.
export async function authorise(
  churchId: string,
  purpose: RecordUploadPurpose
): Promise<{ ok: true; profile: CurrentProfile; supabase: Supabase; folder: string } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (profile.role === "member" || !can(profile, capabilityFor(purpose))) return { ok: false, error: "Not permitted." };
  const supabase = await createClient();
  const { data: church } = await supabase.from("churches").select("id").eq("id", churchId).maybeSingle();
  if (!church) return { ok: false, error: "That chapter isn't one you look after." };
  return { ok: true, profile, supabase, folder: `${profile.zoneId}/${churchId}` };
}


"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { DATA_REQUEST_KINDS } from "@/lib/privacy";
import { TOO_MANY, withinRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { DataRequestKind, DataRequestStatus } from "@/lib/supabase/types";
import { tenant } from "@/tenant";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

// Records that this login accepted the current privacy notice. profiles has
// no write policies, so the server writes it — for the signed-in user only.
export async function acceptPrivacyNotice(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ privacy_accepted_version: tenant.legal.privacyNoticeVersion, privacy_accepted_at: new Date().toISOString() })
    .eq("id", profile.userId);
  if (error) return { ok: false, error: "Couldn't save that — please try again." };
  redirect(profile.role === "member" ? "/me" : "/dashboard");
}

export async function submitDataRequest(input: { kind: DataRequestKind; details: string }): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };
  if (!DATA_REQUEST_KINDS.some((k) => k.value === input.kind)) return { ok: false, error: "Pick what you'd like us to do." };
  const details = input.details.trim();
  if (!details) return { ok: false, error: "Tell us a little more so we can help." };
  if (details.length > 4000) return { ok: false, error: "Keep it under 4,000 characters." };
  if (!(await withinRateLimit(`data-request:${profile.userId}`, 5, 24 * 3600))) return { ok: false, error: TOO_MANY };

  const supabase = await createClient();
  const { error } = await supabase.from("data_requests").insert({
    zone_id: profile.zoneId,
    profile_id: profile.userId,
    member_id: profile.linkedMemberId,
    requester_name: profile.fullName,
    requester_email: profile.email,
    kind: input.kind,
    details,
  });
  if (error) return { ok: false, error: "We couldn't send that just now — please try again." };
  revalidatePath("/my-data");
  revalidatePath("/settings/privacy");
  return { ok: true };
}

export async function updateDataRequest(requestId: string, status: DataRequestStatus, response: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_access")) return { ok: false, error: "Not permitted." };
  if (!["open", "in_progress", "completed", "declined"].includes(status)) return { ok: false, error: "Unknown status." };
  const text = response.trim();
  if ((status === "completed" || status === "declined") && !text) {
    return { ok: false, error: "Say what was done (or why it was declined) — the person will see this." };
  }
  if (text.length > 4000) return { ok: false, error: "Keep the response under 4,000 characters." };

  const supabase = await createClient();
  const closed = status === "completed" || status === "declined";
  const { data, error } = await supabase
    .from("data_requests")
    .update({
      status,
      response: text || null,
      resolved_at: closed ? new Date().toISOString() : null,
      resolved_by: closed ? profile.userId : null,
    })
    .eq("id", requestId)
    .select("kind")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That request no longer exists." };

  await logAudit(profile, "privacy.request_update", `Marked a ${data.kind} request ${status.replace("_", " ")}`, {
    entity: { type: "data_request", id: requestId },
  });
  revalidatePath("/settings/privacy");
  return { ok: true };
}

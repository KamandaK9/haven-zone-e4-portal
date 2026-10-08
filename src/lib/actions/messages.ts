"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getCurrentProfile, type CurrentProfile } from "@/lib/data/get-dataset";
import { resolveAudience, type Audience } from "@/lib/messaging/audience";
import { dispatchMessage } from "@/lib/messaging/dispatch";
import { getMessagingSettings, getSmsUsage } from "@/lib/messaging/settings";
import { smsIsConfigured } from "@/lib/messaging/twilio";
import { emailIsConfigured } from "@/lib/email";
import { logAudit } from "./audit";
import type { ActionResult } from "./members";

export type MessageInput = { channel: "sms" | "email"; subject?: string; body: string; audience: Audience };

export type AudiencePreview =
  | {
      ok: true;
      matched: number;
      count: number;
      skipped: { optedOut: number; noContact: number; noGuardian: number; duplicate: number };
      segments: number;
      estimatedCost: number;
      remaining: number | null;
      overCap: boolean;
      sample: string | null;
      toGuardians: number;
    }
  | { ok: false; error: string };

async function sender(): Promise<{ ok: true; profile: CurrentProfile } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "send_messages") && !can(profile, "approve_messages")) return { ok: false, error: "You can't send messages." };
  return { ok: true, profile };
}

async function approver(): Promise<{ ok: true; profile: CurrentProfile } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "approve_messages")) return { ok: false, error: "Only someone who approves messages can do that." };
  return { ok: true, profile };
}

function validate(input: MessageInput): string | null {
  if (!input.body.trim()) return "Write the message first.";
  if (input.body.length > 1000) return "That's too long — keep it under 1,000 characters.";
  if (input.channel === "email" && !input.subject?.trim()) return "Give the email a subject.";
  return null;
}

// What sending this would do, without sending anything.
export async function previewAudience(input: MessageInput): Promise<AudiencePreview> {
  const auth = await sender();
  if (!auth.ok) return auth;
  if (!input.body.trim()) return { ok: false, error: "Write the message to see who it reaches." };
  const settings = await getMessagingSettings(auth.profile.zoneId);
  const { recipients, skipped, matched } = await resolveAudience(await createClient(), input.audience, input.channel, { self: input.body }, { footer: settings.smsFooter });
  const segments = recipients.reduce((n, r) => n + r.segments, 0);
  const usage = input.channel === "sms" ? await getSmsUsage(auth.profile.zoneId, settings) : undefined;
  return {
    ok: true,
    matched,
    count: recipients.length,
    skipped,
    segments,
    estimatedCost: input.channel === "sms" ? segments * settings.smsCostEstimate : 0,
    remaining: usage ? usage.remaining : null,
    overCap: !!usage && segments > usage.remaining,
    sample: recipients[0]?.body ?? null,
    toGuardians: recipients.filter((r) => r.via === "guardian").length,
  };
}

// Writes the message and its recipients. An approver's message goes out
// straight away; anyone else's waits for approval.
export async function createMessage(input: MessageInput): Promise<ActionResult & { id?: string; sent?: boolean; note?: string }> {
  const auth = await sender();
  if (!auth.ok) return auth;
  const { profile } = auth;
  const problem = validate(input);
  if (problem) return { ok: false, error: problem };

  const settings = await getMessagingSettings(profile.zoneId);
  const { recipients } = await resolveAudience(await createClient(), input.audience, input.channel, { self: input.body }, { footer: settings.smsFooter });
  if (recipients.length === 0) return { ok: false, error: "Nobody in that audience can be reached — they have no number or address, or opted out." };

  const approves = can(profile, "approve_messages");
  const admin = createAdminClient();
  const { data: message, error } = await admin
    .from("messages")
    .insert({
      zone_id: profile.zoneId,
      kind: "manual",
      channel: input.channel,
      subject: input.channel === "email" ? input.subject!.trim() : null,
      body: input.body.trim(),
      audience: input.audience as never,
      status: approves ? "approved" : "pending",
      created_by: profile.userId,
      created_by_name: profile.fullName,
      ...(approves ? { approved_by: profile.userId, approved_by_name: profile.fullName, approved_at: new Date().toISOString() } : {}),
    })
    .select("id")
    .single();
  if (error || !message) return { ok: false, error: error?.message ?? "Couldn't save the message." };

  for (let i = 0; i < recipients.length; i += 500) {
    const { error: rowError } = await admin.from("message_recipients").insert(
      recipients.slice(i, i + 500).map((r) => ({
        message_id: message.id,
        zone_id: profile.zoneId,
        member_id: r.memberId,
        channel: input.channel,
        name: r.name,
        to_address: r.to,
        via: r.via,
        body: r.body,
        segments: r.segments,
      }))
    );
    if (rowError) {
      await admin.from("messages").delete().eq("id", message.id);
      return { ok: false, error: rowError.message };
    }
  }
  await logAudit(profile, "message.create", `${approves ? "Sent" : "Submitted"} a ${input.channel === "sms" ? "text" : "email"} to ${recipients.length} people`, { entity: { type: "message", id: message.id } });
  revalidatePath("/messages");

  if (!approves) return { ok: true, id: message.id, sent: false };
  const result = await dispatchMessage(message.id);
  return { ok: true, id: message.id, sent: result.ok, note: result.ok ? undefined : result.error };
}

export async function approveMessage(id: string): Promise<ActionResult & { note?: string }> {
  const auth = await approver();
  if (!auth.ok) return auth;
  const { profile } = auth;
  const { data: claimed } = await createAdminClient()
    .from("messages")
    .update({ status: "approved", approved_by: profile.userId, approved_by_name: profile.fullName, approved_at: new Date().toISOString() })
    .eq("id", id)
    .eq("zone_id", profile.zoneId)
    .eq("status", "pending")
    .select("id");
  if (!claimed?.length) return { ok: false, error: "That message isn't waiting for approval any more." };
  await logAudit(profile, "message.approve", "Approved a message", { entity: { type: "message", id } });
  const result = await dispatchMessage(id);
  revalidatePath("/messages");
  revalidatePath(`/messages/${id}`);
  return { ok: true, note: result.ok ? undefined : result.error };
}

export async function rejectMessage(id: string, note: string): Promise<ActionResult> {
  const auth = await approver();
  if (!auth.ok) return auth;
  const { data } = await createAdminClient()
    .from("messages")
    .update({ status: "rejected", note: note.trim() || null, approved_by: auth.profile.userId, approved_by_name: auth.profile.fullName })
    .eq("id", id)
    .eq("zone_id", auth.profile.zoneId)
    .eq("status", "pending")
    .select("id");
  if (!data?.length) return { ok: false, error: "That message isn't waiting for approval any more." };
  await logAudit(auth.profile, "message.reject", "Declined a message", { entity: { type: "message", id } });
  revalidatePath("/messages");
  revalidatePath(`/messages/${id}`);
  return { ok: true };
}

// Withdrawing a message that hasn't gone out: its sender, or an approver.
export async function cancelMessage(id: string): Promise<ActionResult> {
  const auth = await sender();
  if (!auth.ok) return auth;
  const { profile } = auth;
  const supabase = await createClient();
  const { data: visible } = await supabase.from("messages").select("id, created_by").eq("id", id).maybeSingle();
  if (!visible) return { ok: false, error: "That message isn't yours to cancel." };
  if (visible.created_by !== profile.userId && !can(profile, "approve_messages")) return { ok: false, error: "That message isn't yours to cancel." };
  const { data } = await createAdminClient().from("messages").update({ status: "cancelled" }).eq("id", id).in("status", ["pending", "approved"]).select("id");
  if (!data?.length) return { ok: false, error: "That message has already gone out." };
  await logAudit(profile, "message.cancel", "Cancelled a message", { entity: { type: "message", id } });
  revalidatePath("/messages");
  revalidatePath(`/messages/${id}`);
  return { ok: true };
}

// Trying again a message that was approved but couldn't go (no keys yet,
// over the cap, nothing delivered).
export async function retryMessage(id: string): Promise<ActionResult & { note?: string }> {
  const auth = await approver();
  if (!auth.ok) return auth;
  const result = await dispatchMessage(id);
  revalidatePath("/messages");
  revalidatePath(`/messages/${id}`);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export type SettingsInput = {
  monthlySmsCap: number;
  smsCostEstimate: number;
  smsFooter: string;
  birthdayEnabled: boolean;
  welcomeEnabled: boolean;
  missedEnabled: boolean;
  digestEnabled: boolean;
  birthdayTemplate: string;
  birthdayGuardianTemplate: string;
  welcomeTemplate: string;
  missedTemplate: string;
};

export async function saveMessagingSettings(input: SettingsInput): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_settings")) return { ok: false, error: "Only admins can change messaging settings." };
  if (!Number.isInteger(input.monthlySmsCap) || input.monthlySmsCap < 0 || input.monthlySmsCap > 1_000_000) return { ok: false, error: "The monthly cap must be a whole number of texts." };
  if (!(input.smsCostEstimate >= 0) || input.smsCostEstimate > 10) return { ok: false, error: "Enter what one text costs, e.g. 0.06." };
  const { error } = await createAdminClient().from("messaging_settings").upsert({
    zone_id: profile.zoneId,
    monthly_sms_cap: input.monthlySmsCap,
    sms_cost_estimate: input.smsCostEstimate,
    sms_footer: input.smsFooter.trim().slice(0, 80),
    birthday_enabled: input.birthdayEnabled,
    welcome_enabled: input.welcomeEnabled,
    missed_enabled: input.missedEnabled,
    digest_enabled: input.digestEnabled,
    birthday_template: input.birthdayTemplate.trim() || null,
    birthday_guardian_template: input.birthdayGuardianTemplate.trim() || null,
    welcome_template: input.welcomeTemplate.trim() || null,
    missed_template: input.missedTemplate.trim() || null,
    updated_by: profile.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  await logAudit(profile, "settings.messaging", "Changed the messaging settings");
  revalidatePath("/messages");
  revalidatePath("/settings/messaging");
  return { ok: true };
}

// Whether each channel can send right now — for the page to say so.
export async function messagingStatus(): Promise<{ sms: boolean; email: boolean }> {
  return { sms: smsIsConfigured(), email: emailIsConfigured() };
}

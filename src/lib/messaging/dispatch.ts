import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailIsConfigured, sendEmailOne } from "@/lib/email";
import { getMessagingSettings, getSmsUsage } from "./settings";
import { sendSms, smsIsConfigured } from "./twilio";
import { tenant } from "@/tenant";

// Sending an approved message: each recipient is delivered on its own and
// its result recorded, so a half-sent message can be seen and finished.
// A message is claimed (approved → sending) before anything goes out, so two
// requests can never send it twice.

export type DispatchResult =
  | { ok: true; sent: number; failed: number }
  | { ok: false; error: string; waiting?: boolean };

const CONCURRENCY = 8;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function dispatchMessage(messageId: string): Promise<DispatchResult> {
  const admin = createAdminClient();
  const { data: message } = await admin.from("messages").select("*").eq("id", messageId).maybeSingle();
  if (!message) return { ok: false, error: "That message doesn't exist." };
  if (message.status !== "approved") return { ok: false, error: `That message is ${message.status}, not waiting to send.` };

  const configured = message.channel === "sms" ? smsIsConfigured() : emailIsConfigured();
  if (!configured) {
    const error = message.channel === "sms" ? "SMS isn't connected yet — it will send once the Twilio keys are added." : "Email isn't connected yet — it will send once an email provider is added.";
    await admin.from("messages").update({ note: error }).eq("id", messageId);
    return { ok: false, error, waiting: true };
  }

  const { data: queued } = await admin.from("message_recipients").select("id, name, to_address, body, segments").eq("message_id", messageId).eq("status", "queued");
  const todo = queued ?? [];

  if (message.channel === "sms" && todo.length > 0) {
    const settings = await getMessagingSettings(message.zone_id);
    const usage = await getSmsUsage(message.zone_id, settings);
    const needed = todo.reduce((n, r) => n + r.segments, 0);
    if (needed > usage.remaining) {
      const error = `That would use ${needed} texts, but only ${usage.remaining} are left this month (cap ${usage.cap}). Raise the cap in Settings → Messaging, or wait for next month.`;
      await admin.from("messages").update({ note: error }).eq("id", messageId);
      return { ok: false, error, waiting: true };
    }
  }

  const { data: claimed } = await admin.from("messages").update({ status: "sending", note: null }).eq("id", messageId).eq("status", "approved").select("id");
  if (!claimed?.length) return { ok: false, error: "That message is already being sent." };

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    await Promise.all(
      todo.slice(i, i + CONCURRENCY).map(async (r) => {
        const result =
          message.channel === "sms"
            ? await sendSms(r.to_address, r.body)
            : await sendEmailOne({
                to: r.to_address,
                subject: message.subject || `A message from ${tenant.name}`,
                text: r.body,
                html: `<p style="font-family:sans-serif;font-size:15px;line-height:1.5;white-space:pre-wrap">${escapeHtml(r.body)}</p>`,
              });
        if (result.ok) {
          sent++;
          await admin.from("message_recipients").update({ status: "sent", provider_id: result.id, sent_at: new Date().toISOString(), error: null }).eq("id", r.id);
        } else {
          failed++;
          await admin.from("message_recipients").update({ status: "failed", error: result.error.slice(0, 300) }).eq("id", r.id);
        }
      })
    );
  }

  if (todo.length > 0 && sent === 0) {
    // Nothing got through (a bad key, an unverified sender…): put it back so
    // it can be retried once that's fixed, with the failed ones queued again.
    await admin.from("message_recipients").update({ status: "queued" }).eq("message_id", messageId).eq("status", "failed");
    const { data: why } = await admin.from("message_recipients").select("error").eq("message_id", messageId).limit(1).maybeSingle();
    const error = why?.error ?? "Nothing could be delivered.";
    await admin.from("messages").update({ status: "approved", note: `Nothing was delivered: ${error}` }).eq("id", messageId);
    return { ok: false, error: `Nothing was delivered: ${error}`, waiting: true };
  }

  await admin
    .from("messages")
    .update({ status: "sent", sent_at: new Date().toISOString(), note: failed > 0 ? `${failed} couldn't be delivered.` : null })
    .eq("id", messageId);
  return { ok: true, sent, failed };
}

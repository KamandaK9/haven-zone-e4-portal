import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Twilio's REST API, called directly (no SDK), like the other providers in
// this app. Needs TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN, plus a sender:
// TWILIO_MESSAGING_SERVICE_SID, or TWILIO_FROM (a number you own, so people
// can reply STOP — an alphanumeric name can't receive replies).

export type SmsResult = { ok: true; id: string } | { ok: false; error: string; notConfigured?: boolean };

export function smsIsConfigured(): boolean {
  return (
    !!process.env.TWILIO_ACCOUNT_SID?.trim() &&
    !!process.env.TWILIO_AUTH_TOKEN?.trim() &&
    (!!process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || !!process.env.TWILIO_FROM?.trim())
  );
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  if (!smsIsConfigured()) {
    return { ok: false, notConfigured: true, error: "SMS isn't connected yet — add the Twilio keys (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM) to the deployment's settings." };
  }
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const form = new URLSearchParams({ To: to, Body: body });
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  if (service) form.set("MessagingServiceSid", service);
  else form.set("From", process.env.TWILIO_FROM!.trim());
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN!.trim()}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: data?.message ?? `Twilio returned ${res.status}.` };
    return { ok: true, id: data?.sid ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach Twilio." };
  }
}

// Twilio signs each webhook it sends: base64(HMAC-SHA1(auth token,
// full URL + every POST field sorted by name, each name followed by its value)).
export function twilioSignatureValid(url: string, fields: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!token || !signature) return false;
  const data = url + Object.keys(fields).sort().map((k) => k + fields[k]).join("");
  const expected = createHmac("sha1", token).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

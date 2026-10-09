import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/site-url";
import { phoneKey } from "@/lib/messaging/text";
import { twilioSignatureValid } from "@/lib/messaging/twilio";

// Twilio calls this when someone replies to a text. STOP (and its synonyms)
// opts that number out of every message; START opts it back in. A child's
// guardian opting out stops the child's messages too, since those go to the
// guardian's number. Twilio signs every request; anything unsigned or wrongly
// signed is refused.
const STOP = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const START = new Set(["START", "UNSTOP", "YES"]);
const EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const xml = (status = 200) => new Response(EMPTY, { status, headers: { "Content-Type": "text/xml" } });

export async function POST(request: Request) {
  const form = await request.formData();
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") fields[k] = v;

  const url = `${await getSiteUrl()}/api/messaging/twilio-inbound`;
  if (!twilioSignatureValid(url, fields, request.headers.get("x-twilio-signature"))) return new Response("Forbidden", { status: 403 });

  const word = (fields.Body ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  const optOut = STOP.has(word) ? true : START.has(word) ? false : undefined;
  const key = phoneKey(fields.From);
  if (optOut === undefined || !key) return xml();

  const admin = createAdminClient();
  const { data: members } = await admin.from("members").select("id, phone, guardian_phone").limit(100000);
  const ids = (members ?? []).filter((m) => phoneKey(m.phone) === key || phoneKey(m.guardian_phone) === key).map((m) => m.id);
  if (ids.length > 0) await admin.from("members").update({ messaging_opt_out: optOut }).in("id", ids);
  return xml();
}

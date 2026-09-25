"use server";

import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getMembersByChurch, getMembersByCountry } from "@/lib/data/analytics";
import { sendEmail, type SendEmailResult } from "@/lib/email";
import { logAudit } from "./audit";

export type SendNewsletterResult =
  | { ok: true; sent: number; skipped: number }
  | { ok: false; error: string; notConfigured?: boolean };

// Resend has no documented hard cap on bcc recipients, but a very large
// zone-wide send still gets chunked — keeps any one request body/timeout
// reasonable and means one bad chunk doesn't sink the whole send.
const CHUNK_SIZE = 300;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function renderHtml(zoneName: string, subject: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 1em;white-space:pre-wrap;">${escapeHtml(p)}</p>`)
    .join("");
  return `<!doctype html>
<html><body style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:600px;margin:0 auto;padding:24px 16px;">
<h1 style="font-size:18px;margin:0 0 16px;">${escapeHtml(subject)}</h1>
${paragraphs}
<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">${escapeHtml(zoneName)}</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendNewsletter(input: { group: string; subject: string; body: string }): Promise<SendNewsletterResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "send_newsletter")) return { ok: false, error: "Not permitted." };

  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || !body) return { ok: false, error: "Subject and message are both required." };

  const ds = await getZoneDataset(profile.zoneId);
  const audience =
    input.group === "zone"
      ? ds.members
      : input.group.startsWith("country:")
        ? getMembersByCountry(ds, input.group.slice("country:".length))
        : input.group.startsWith("church:")
          ? getMembersByChurch(ds, input.group.slice("church:".length))
          : [];

  const recipients = [...new Set(audience.map((m) => m.email?.trim().toLowerCase()).filter((e): e is string => !!e))];
  const skipped = audience.length - recipients.length;
  if (recipients.length === 0) return { ok: false, error: "Nobody in that group has an email on file." };

  const html = renderHtml(ds.zoneName, subject, body);
  const text = body;

  let sent = 0;
  let lastError: SendEmailResult | null = null;
  for (const batch of chunk(recipients, CHUNK_SIZE)) {
    const result = await sendEmail({ to: profile.email, bcc: batch, subject, html, text });
    if (!result.ok) {
      lastError = result;
      break; // stop rather than partially blast a broken send
    }
    sent += batch.length;
  }

  if (sent === 0 && lastError) {
    return { ok: false, error: lastError.error, notConfigured: lastError.notConfigured };
  }

  await logAudit(
    profile,
    "newsletter.send",
    `Sent "${subject}" to ${sent} recipient${sent === 1 ? "" : "s"}${lastError ? ` — stopped early: ${lastError.error}` : ""}`
  );

  if (lastError) return { ok: false, error: `Sent to ${sent} before failing: ${lastError.error}` };
  return { ok: true, sent, skipped };
}

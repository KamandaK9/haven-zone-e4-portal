import "server-only";

// Content emails (newsletter, messages, support, digests) over a provider's
// REST API — SendGrid or Resend, no SDK, matching how this app calls other
// third-party APIs (see currency-server.ts). Auth emails (invites, password
// resets) go through Supabase's own SMTP instead, configured separately in the
// Supabase dashboard.
//
// The sender address's domain (or address) has to be verified with the
// provider before anything is delivered.

export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string; notConfigured?: boolean };

// SendGrid (SENDGRID_API_KEY + EMAIL_FROM) is used when its key is set;
// otherwise Resend (RESEND_API_KEY + RESEND_FROM_EMAIL), as before.
const sendGridConfigured = () => !!process.env.SENDGRID_API_KEY?.trim() && !!(process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL)?.trim();

export function emailIsConfigured(): boolean {
  return sendGridConfigured() || (!!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL);
}

// "CE Sandton <hello@example.org>" or a bare address.
export function parseFrom(raw: string): { email: string; name?: string } {
  const m = raw.trim().match(/^(.*)<([^>]+)>$/);
  return m ? { email: m[2].trim(), name: m[1].trim().replace(/^"|"$/g, "") || undefined } : { email: raw.trim() };
}

const NOT_CONFIGURED =
  "No email provider is set up yet — add SENDGRID_API_KEY and EMAIL_FROM (or RESEND_API_KEY and RESEND_FROM_EMAIL) to the deployment's settings.";

export async function sendEmail(input: {
  to: string; // shown as the sender's own copy — real recipients go in bcc
  bcc: string[];
  subject: string;
  html: string;
  text: string;
  // Where replies go, e.g. the member who asked for help.
  replyTo?: string;
}): Promise<SendEmailResult> {
  if (!emailIsConfigured()) return { ok: false, notConfigured: true, error: NOT_CONFIGURED };

  try {
    if (sendGridConfigured()) {
      const from = parseFrom((process.env.EMAIL_FROM ?? process.env.RESEND_FROM_EMAIL)!);
      const to = input.to.toLowerCase();
      const bcc = [...new Set(input.bcc.map((e) => e.toLowerCase()))].filter((e) => e !== to);
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: input.to }], ...(bcc.length ? { bcc: bcc.map((email) => ({ email })) } : {}) }],
          from,
          subject: input.subject,
          content: [
            { type: "text/plain", value: input.text },
            { type: "text/html", value: input.html },
          ],
          ...(input.replyTo ? { reply_to: { email: input.replyTo } } : {}),
        }),
      });
      if (res.status === 202) return { ok: true, id: res.headers.get("x-message-id") ?? "" };
      const data = await res.json().catch(() => null);
      return { ok: false, error: data?.errors?.[0]?.message ?? `Email provider returned ${res.status}.` };
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: [input.to],
        bcc: input.bcc,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: (data && (data.message ?? data.error)) || `Email provider returned ${res.status}.` };
    }
    return { ok: true, id: data?.id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach the email provider." };
  }
}

// One email to one person (a personalised message), through the same provider.
export async function sendEmailOne(input: { to: string; subject: string; text: string; html: string; replyTo?: string }): Promise<SendEmailResult> {
  return sendEmail({ to: input.to, bcc: [], subject: input.subject, html: input.html, text: input.text, replyTo: input.replyTo });
}

import "server-only";

// A thin wrapper over Resend's REST API — no SDK dependency, matching how
// this app already calls out to other third-party APIs (see
// currency-server.ts). Used for actual content emails (the newsletter);
// auth emails (invites, password resets) go through Supabase's own SMTP
// instead, configured separately in the Supabase dashboard.
//
// Both RESEND_API_KEY and RESEND_FROM_EMAIL have to be set, and the "from"
// address's domain has to be verified in Resend, before this can send
// anything for real.

export type SendEmailResult = { ok: true; id: string } | { ok: false; error: string; notConfigured?: boolean };

export function emailIsConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM_EMAIL;
}

export async function sendEmail(input: {
  to: string; // shown as the sender's own copy — real recipients go in bcc
  bcc: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return {
      ok: false,
      notConfigured: true,
      error: "No email provider is set up for this zone yet — ask whoever manages the Supabase project to add RESEND_API_KEY and RESEND_FROM_EMAIL.",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [input.to], bcc: input.bcc, subject: input.subject, html: input.html, text: input.text }),
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

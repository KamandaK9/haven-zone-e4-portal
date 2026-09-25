"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { emailIsConfigured, sendEmail } from "@/lib/email";
import { SUPPORT_CATEGORIES, supportCategoryLabel } from "@/lib/support";
import type { SupportCategory } from "@/lib/supabase/types";
import { tenant } from "@/tenant";
import type { ActionResult } from "./members";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// Saves the request, then emails it to SUPPORT_EMAIL if email is set up —
// replies go straight to the person who asked. The saved copy is the source
// of truth either way, so an email outage loses nothing.
export async function submitSupportRequest(input: { category: SupportCategory; message: string; pagePath?: string }): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Please sign in again." };
  const message = input.message.trim();
  if (!message) return { ok: false, error: "Tell us what you need help with." };
  if (message.length > 4000) return { ok: false, error: "That's a bit long — keep it under 4,000 characters." };
  if (!SUPPORT_CATEGORIES.some((c) => c.value === input.category)) return { ok: false, error: "Pick what it's about." };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("support_requests")
    .insert({
      zone_id: profile.zoneId,
      profile_id: profile.userId,
      requester_name: profile.fullName,
      requester_email: profile.email,
      category: input.category,
      message,
      page_path: input.pagePath?.slice(0, 300) || null,
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: "We couldn't send that just now — please try again." };

  const to = process.env.SUPPORT_EMAIL?.trim();
  if (to && emailIsConfigured()) {
    const label = supportCategoryLabel(input.category);
    const lines = [
      `${profile.fullName} (${profile.email}) asked for help — ${label}.`,
      ...(input.pagePath ? [`They were on: ${input.pagePath}`] : []),
      "",
      ...message.split("\n"),
      "",
      "Reply to this email to answer them directly.",
    ];
    const result = await sendEmail({
      to,
      bcc: [],
      replyTo: profile.email,
      subject: `[${tenant.portalName}] ${label} — ${profile.fullName}`,
      text: lines.join("\n"),
      html: lines.map((l) => (l ? `<p>${escape(l)}</p>` : "")).join(""),
    });
    // The asker can't update their own row; record the outcome as the server.
    await createAdminClient()
      .from("support_requests")
      .update({ email_status: result.ok ? "sent" : "failed" })
      .eq("id", row.id);
  }

  revalidatePath("/settings/support");
  return { ok: true };
}

export async function setSupportRequestStatus(requestId: string, status: "open" | "resolved"): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not signed in." };
  if (!can(profile, "manage_access")) return { ok: false, error: "Not permitted." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("support_requests")
    .update(
      status === "resolved"
        ? { status, resolved_at: new Date().toISOString(), resolved_by: profile.userId }
        : { status, resolved_at: null, resolved_by: null }
    )
    .eq("id", requestId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/support");
  return { ok: true };
}

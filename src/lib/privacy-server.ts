import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tenant } from "@/tenant";

// Sends a login to /privacy/accept until they've accepted the current
// privacy notice (and again whenever legal.privacyNoticeVersion changes).
// Called from the signed-in layouts. If the privacy columns don't exist yet
// (migration not applied) it steps aside rather than locking everyone out.
export async function requirePrivacyAccepted(userId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("privacy_accepted_version").eq("id", userId).maybeSingle();
  if (error || !data) return;
  if (data.privacy_accepted_version !== tenant.legal.privacyNoticeVersion) redirect("/privacy/accept");
}

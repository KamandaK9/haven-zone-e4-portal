import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Redirects to /mfa-challenge when this session has a verified authenticator
// factor it hasn't cleared yet (nextLevel is aal2, currentLevel isn't) — the
// normal state right after a password sign-in on an MFA-enrolled account.
// Called from (portal)/layout.tsx and (member)/layout.tsx, after the
// profile/setup checks there. A login with no verified factor is unaffected
// (nextLevel stays aal1) — enrolling via /security is what turns this on.
export async function requireAal2IfEnrolled(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return;
  if (data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
    redirect("/mfa-challenge");
  }
}

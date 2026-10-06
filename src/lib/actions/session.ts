"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { IDLE_LIMIT_COOKIE, LEADER_IDLE_MINUTES, LAST_SEEN_COOKIE, MEMBER_IDLE_MINUTES } from "@/lib/idle";
import { createClient } from "@/lib/supabase/server";

// Records this login's idle limit in an httpOnly cookie, so the proxy can
// sign out a session that's been left too long even when no page was open
// to notice. Decided here, from the signed-in profile — never by the browser.
export async function registerIdleLimit(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const minutes = profile.role === "member" ? MEMBER_IDLE_MINUTES : LEADER_IDLE_MINUTES;
  (await cookies()).set(IDLE_LIMIT_COOKIE, String(minutes), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function signOutForInactivity(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const jar = await cookies();
  jar.delete(LAST_SEEN_COOKIE);
  jar.delete(IDLE_LIMIT_COOKIE);
  redirect("/?signedOut=idle");
}

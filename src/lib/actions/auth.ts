"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Testing-only escape hatch: signs the current account out and lands on the
// wizard instead of the login page, so a fresh zone can be set up without
// leaving the browser session. Remove once real zones are onboarded.
export async function restartWizardAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/setup");
}

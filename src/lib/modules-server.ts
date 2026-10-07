import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { effectiveModules, type Modules } from "./modules";

// The features switched on for this deployment, read once per request. A
// deployment has a single zone, so this needs no signed-in user — public
// pages (the QR check-in page) use it too.
export const getModules = cache(async (): Promise<Modules> => {
  const { data } = await createAdminClient().from("zones").select("disabled_modules").limit(1).maybeSingle();
  return effectiveModules((data as { disabled_modules?: string[] } | null)?.disabled_modules ?? []);
});

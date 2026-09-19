import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Bypasses Row Level Security entirely via the service-role key. Only ever
// import this from "use server" files (setup/account bootstrap) — the
// `server-only` import above makes accidentally bundling it into client code
// a build error rather than a leaked secret.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Caps how often one person (or zone) can do something that sends email or
// could be used to flood others: `max` times per `windowSeconds`. Backed by
// the take_rate_limit() database function (server-only). If the database
// isn't set up for it yet, actions aren't blocked — the limit only starts
// working once the security migration is applied.
export async function withinRateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("take_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data !== false;
}

export const TOO_MANY = "You're doing that too often — please wait a little and try again.";

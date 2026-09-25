import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// /setup creates an organisation and its super_admin, so it's gated twice:
// the caller must present the deployment's SETUP_KEY, and it only ever runs
// once — one organisation per deployment.

// False when SETUP_KEY is unset, which disables setup entirely.
export function isSetupEnabled(): boolean {
  return !!process.env.SETUP_KEY;
}

export function setupKeyMatches(key: unknown): boolean {
  const expected = process.env.SETUP_KEY;
  if (!expected || typeof key !== "string") return false;
  // Hashing first gives equal-length buffers, so timingSafeEqual doesn't
  // throw (or leak the key's length) when the lengths differ.
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(key), digest(expected));
}

// True once any zone has finished setup. Fails closed: a query error counts
// as "a completed zone exists".
export async function hasCompletedZone(): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("zones")
    .select("id", { count: "exact", head: true })
    .eq("setup_complete", true);
  return !!error || (count ?? 0) > 0;
}

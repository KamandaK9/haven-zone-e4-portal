import "server-only";
import { headers } from "next/headers";

// The absolute base URL to build email-confirmation links from (invites,
// password resets). Prefer an explicit env var — request headers can be
// wrong behind some proxies/previews — but fall back to the incoming
// request's own host so this works with zero config in most setups.
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Content-Security-Policy for every page: the browser refuses to run any
// script that didn't come from this site with this request's nonce, and
// only talks to the services the portal actually uses. If a feature adds a
// new outside service (an embed, an API called from the browser), add its
// origin here or the browser will block it.

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

// Hosted video and its playback analytics (Mux), lesson/event video embeds.
const MUX = "https://*.mux.com https://*.litix.io";
const EMBEDS = "https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com";

export function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are used by charts and the video player.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabaseOrigin} https://image.mux.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs} ${MUX}`,
    `media-src 'self' blob: ${supabaseOrigin} ${MUX}`,
    "worker-src 'self' blob:",
    `frame-src ${EMBEDS}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ]
    .join("; ")
    .replace(/\s{2,}/g, " ");
}

// Headers that don't change per request (next.config.ts).
export const STATIC_SECURITY_HEADERS = [
  // Always HTTPS once seen (2 years), including subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Never shown inside another site's frame (clickjacking); CSP says the same.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see only our origin, never a path or query (e.g. ?key=).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera/mic/screen only for this site (lesson recording); nothing else.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

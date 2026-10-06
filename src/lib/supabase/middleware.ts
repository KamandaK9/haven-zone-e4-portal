import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy } from "@/lib/security-headers";
import { IDLE_LIMIT_COOKIE, LAST_SEEN_COOKIE, MEMBER_IDLE_MINUTES } from "@/lib/idle";

export async function updateSession(request: NextRequest) {
  // A fresh nonce per request: Next.js reads it from the CSP request header
  // and stamps it on its own scripts (see src/lib/security-headers.ts).
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const forward = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    return NextResponse.next({ request: { headers } });
  };

  let response = forward();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = forward();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Refreshes the session token if needed — the resulting Set-Cookie (if
  // any) is written above via setAll. Route protection itself lives in
  // (portal)/layout.tsx, not here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Inactivity sign-out, server side: a session that hasn't made a request
  // for longer than its login's idle limit (see registerIdleLimit) is ended
  // here, even if no page was left open to notice.
  if (user) {
    const limitMinutes = Number(request.cookies.get(IDLE_LIMIT_COOKIE)?.value) || MEMBER_IDLE_MINUTES;
    const lastSeen = Number(request.cookies.get(LAST_SEEN_COOKIE)?.value);
    const now = Date.now();
    if (lastSeen && now - lastSeen > limitMinutes * 60_000) {
      await supabase.auth.signOut();
      const expired = NextResponse.redirect(new URL("/?signedOut=idle", request.url));
      for (const c of response.cookies.getAll()) expired.cookies.set(c);
      expired.cookies.delete(LAST_SEEN_COOKIE);
      expired.cookies.delete(IDLE_LIMIT_COOKIE);
      expired.headers.set("Content-Security-Policy", csp);
      return expired;
    }
    response.cookies.set(LAST_SEEN_COOKIE, String(now), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

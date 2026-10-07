import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

// Only a path on this site: "/x" yes; "//evil.com", "/\evil.com" or a full
// URL no — otherwise a crafted email link could forward someone elsewhere
// after signing them in.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\") || /[\u0000-\u001f]/.test(raw)) return "/dashboard";
  return raw;
}

// Where a password-reset or invite email's link lands: verifies the token
// from the email, which — for a Route Handler using the ssr package — also
// establishes a real signed-in session via cookies on the response. From
// there `next` (e.g. /reset-password) picks up with that session already
// in place.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  const type = VALID_TYPES.includes(rawType as EmailOtpType) ? (rawType as EmailOtpType) : null;
  const next = safeNext(searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/?authError=1", origin));
}

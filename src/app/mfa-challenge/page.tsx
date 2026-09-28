"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

// Shown after password sign-in when the account has a verified authenticator
// factor and the session hasn't cleared it yet (aal1, not aal2) — see the
// getAuthenticatorAssuranceLevel() check in (portal)/layout.tsx and
// (member)/layout.tsx, which redirect here.
export default function MfaChallengePage() {
  return (
    <Suspense fallback={null}>
      <ChallengeForm />
    </Suspense>
  );
}

function ChallengeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const supabase = createClient();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const verified = data.totp.find((f) => f.status === "verified");
      if (!verified) {
        // Nothing to challenge (shouldn't normally reach this page) — move on.
        router.push(next);
        return;
      }
      setFactorId(verified.id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <BrandMark />
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-semibold">Enter your authentication code</h1>
            <p className="text-sm text-muted-foreground">Open your authenticator app and enter the current code.</p>
          </div>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="challenge-code" className="text-xs">
                  6-digit code
                </Label>
                <Input
                  id="challenge-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
                {busy ? "Verifying…" : "Verify"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

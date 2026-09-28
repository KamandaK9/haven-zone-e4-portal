"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: "verified" | "unverified";
};

// Authenticator-app (TOTP) MFA: enroll, verify the first code, and remove a
// factor later. Once a factor is verified, Supabase requires every future
// sign-in to clear an MFA challenge before the session reaches aal2 — see
// /mfa-challenge and the aal2 check in (portal)/layout.tsx and
// (member)/layout.tsx. There's no separate "require MFA" flag: enrolling is
// what turns the requirement on for that login.
export function MfaEnroll() {
  const router = useRouter();
  const supabase = createClient();
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function refresh() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setError(error.message);
      return;
    }
    setFactors(data.all as Factor[]);
  }

  useEffect(() => {
    (async () => {
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startEnroll() {
    setError(null);
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPendingFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setEnrolling(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingFactorId) return;
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: pendingFactorId, code: code.trim() });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEnrolling(false);
    setQrCode(null);
    setSecret(null);
    setPendingFactorId(null);
    setCode("");
    await refresh();
    router.refresh();
  }

  async function cancelEnroll() {
    if (pendingFactorId) await supabase.auth.mfa.unenroll({ factorId: pendingFactorId });
    setEnrolling(false);
    setQrCode(null);
    setSecret(null);
    setPendingFactorId(null);
    setCode("");
    setError(null);
  }

  async function remove(factorId: string) {
    setRemovingId(factorId);
    setError(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setRemovingId(null);
    if (error) {
      setError(error.message);
      return;
    }
    await refresh();
    router.refresh();
  }

  if (factors === null) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <div className="space-y-4">
      {verified.length > 0 ? (
        <div className="space-y-2">
          {verified.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>{f.friendly_name || "Authenticator app"}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700"
                disabled={removingId === f.id}
                onClick={() => remove(f.id)}
              >
                {removingId === f.id ? "Removing…" : "Remove"}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldOff className="h-4 w-4" /> No authenticator app added yet.
        </p>
      )}

      {enrolling ? (
        <form onSubmit={verify} className="space-y-3 rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-md border bg-white p-2">
              {qrCode && (
                // eslint-disable-next-line @next/next/no-img-element -- qrCode is an inline SVG data URI from Supabase, not a servable asset
                <img src={qrCode} alt="Scan with your authenticator app" width={140} height={140} />
              )}
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 text-foreground text-sm font-medium">
                <Smartphone className="h-4 w-4" /> Scan with your authenticator app
              </p>
              <p>Google Authenticator, Authy, 1Password, etc. Can&apos;t scan? Enter this code manually:</p>
              <code className="block rounded bg-muted px-2 py-1 font-mono text-[11px] break-all">{secret}</code>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mfa-code" className="text-xs">
              6-digit code from the app
            </Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="max-w-[10rem]"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Verify & enable"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={cancelEnroll} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button type="button" variant="outline" size="sm" onClick={startEnroll} disabled={busy}>
            {busy ? "Starting…" : "Add authenticator app"}
          </Button>
        </>
      )}
    </div>
  );
}

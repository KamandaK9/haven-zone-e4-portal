"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { acceptPrivacyNotice } from "@/lib/actions/privacy";

export function AcceptPrivacyForm({ isLeader }: { isLeader: boolean }) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2.5 text-sm">
        <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
        <span>
          I&apos;ve read the privacy notice and agree to the{" "}
          <Link href="/terms" target="_blank" className="underline">
            terms of use
          </Link>
          {isLeader ? ", including keeping other people's information confidential" : ""}.
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        disabled={!agreed || busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await acceptPrivacyNotice();
          setBusy(false);
          if (result && !result.ok) setError(result.error);
        }}
      >
        {busy ? "Saving…" : "Continue"}
      </Button>
    </div>
  );
}

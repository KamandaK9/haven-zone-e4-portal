"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitDataRequest } from "@/lib/actions/privacy";
import { DATA_REQUEST_KINDS } from "@/lib/privacy";
import type { DataRequestKind } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

export function DataRequestForm() {
  const router = useRouter();
  const [kind, setKind] = useState<DataRequestKind>("access");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="flex items-start gap-2 rounded-lg border p-3 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <p>
          Request sent. The Information Officer will respond within 30 days — you&apos;ll see the answer below.{" "}
          <button type="button" className="underline" onClick={() => { setSent(false); setDetails(""); }}>
            Make another request
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        {DATA_REQUEST_KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={cn("rounded-lg border px-3 py-2 text-left text-sm", kind === k.value ? "border-primary bg-primary/5" : "hover:bg-muted")}
          >
            <span className="font-medium">{k.label}</span>
            <span className="block text-xs text-muted-foreground">{k.hint}</span>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dr-details">Details</Label>
        <Textarea id="dr-details" rows={4} maxLength={4000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What would you like us to do?" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        disabled={busy || !details.trim()}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await submitDataRequest({ kind, details });
          setBusy(false);
          if (!result.ok) return setError(result.error);
          setSent(true);
          router.refresh();
        }}
      >
        {busy ? "Sending…" : "Send request"}
      </Button>
    </div>
  );
}

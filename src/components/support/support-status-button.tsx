"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw } from "lucide-react";
import { setSupportRequestStatus } from "@/lib/actions/support";

export function SupportStatusButton({ requestId, status }: { requestId: string; status: "open" | "resolved" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = status === "open" ? "resolved" : "open";
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await setSupportRequestStatus(requestId, next);
        setBusy(false);
        if (result.ok) router.refresh();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
    >
      {status === "open" ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
      {status === "open" ? "Mark resolved" : "Reopen"}
    </button>
  );
}

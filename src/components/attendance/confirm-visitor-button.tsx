"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmVisitor } from "@/lib/actions/visitors";

export function ConfirmVisitorButton({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="gap-1.5"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await confirmVisitor(memberId);
          setBusy(false);
          if (!res.ok) setError(res.error);
          else router.refresh();
        }}
      >
        <UserCheck className="h-3.5 w-3.5" /> Confirm as member
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

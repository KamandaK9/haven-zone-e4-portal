"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteLiveStream } from "@/lib/actions/livestreams";

export function DeleteStreamButton({ streamId, hasReplay }: { streamId: string; hasReplay: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirm) {
    return (
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setConfirm(true)}>
        <Trash2 className="h-3.5 w-3.5" />
        Delete
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        variant="destructive"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await deleteLiveStream(streamId);
          setBusy(false);
          if (!result.ok) return setError(result.error);
          router.push("/live");
        }}
      >
        {hasReplay ? "Delete stream and replay" : "Delete stream"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        Cancel
      </Button>
    </div>
  );
}

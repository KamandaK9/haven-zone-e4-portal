"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateDataRequest } from "@/lib/actions/privacy";
import type { DataRequestStatus } from "@/lib/supabase/types";

export function DataRequestReply({ id, status, response }: { id: string; status: DataRequestStatus; response: string | null }) {
  const router = useRouter();
  const [text, setText] = useState(response ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (next: DataRequestStatus) => {
    setBusy(true);
    setError(null);
    const result = await updateDataRequest(id, next, text);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  };
  const closed = status === "completed" || status === "declined";
  return (
    <div className="space-y-2">
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Response the person will see — what was done, or why not." />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {closed ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => save("in_progress")}>Reopen</Button>
        ) : (
          <>
            {status === "open" && <Button size="sm" variant="outline" disabled={busy} onClick={() => save("in_progress")}>Mark in progress</Button>}
            <Button size="sm" disabled={busy} onClick={() => save("completed")}>Done</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => save("declined")}>Decline</Button>
          </>
        )}
      </div>
    </div>
  );
}

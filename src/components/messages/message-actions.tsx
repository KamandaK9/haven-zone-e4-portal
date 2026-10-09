"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { approveMessage, cancelMessage, rejectMessage, retryMessage } from "@/lib/actions/messages";

export function MessageActions({
  id,
  status,
  canApprove,
  canCancel,
}: {
  id: string;
  status: string;
  canApprove: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string; note?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else if (res.note) setError(res.note);
      router.refresh();
    });

  const open = status === "pending" || status === "approved";
  if (!open) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {status === "pending" && canApprove && (
          <>
            <Button disabled={pending} onClick={() => run(() => approveMessage(id))}>{pending ? "Sending…" : "Approve & send"}</Button>
            <Button variant="outline" disabled={pending} onClick={() => setDeclining((d) => !d)}>Decline</Button>
          </>
        )}
        {status === "approved" && canApprove && (
          <Button disabled={pending} onClick={() => run(() => retryMessage(id))}>{pending ? "Sending…" : "Send now"}</Button>
        )}
        {canCancel && (
          <Button variant="ghost" disabled={pending} onClick={() => confirm("Cancel this message? Nobody will get it.") && run(() => cancelMessage(id))}>
            Cancel message
          </Button>
        )}
      </div>
      {declining && (
        <div className="flex max-w-md gap-2">
          <Input placeholder="Why? (the sender will see this)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="outline" disabled={pending} onClick={() => run(() => rejectMessage(id, reason))}>Decline it</Button>
        </div>
      )}
      {error && <p className="text-sm text-amber-700">{error}</p>}
    </div>
  );
}

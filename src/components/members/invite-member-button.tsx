"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, CheckCircle2, AlertCircle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inviteMemberToPortal } from "@/lib/actions/members";

export function InviteMemberButton({
  memberId,
  hasPortalAccess,
  hasEmail,
}: {
  memberId: string;
  hasPortalAccess: boolean;
  hasEmail: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "inviting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function invite() {
    setState("inviting");
    setError(null);
    const result = await inviteMemberToPortal(memberId);
    if (!result.ok) {
      setError(result.error);
      setState("error");
      return;
    }
    setTempPassword(result.tempPassword);
    setState("idle");
    router.refresh();
  }

  if (hasPortalAccess) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" /> Has portal access
      </span>
    );
  }

  if (tempPassword) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
        <span>One-time password:</span>
        <code className="rounded bg-white px-1.5 py-0.5 font-mono">{tempPassword}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(tempPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="hover:text-emerald-900"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Button size="sm" variant="outline" className="gap-2" onClick={invite} disabled={state === "inviting" || !hasEmail}>
        <UserPlus className="h-3.5 w-3.5" />
        {state === "inviting" ? "Inviting…" : "Invite to portal"}
      </Button>
      {!hasEmail && <p className="text-xs text-muted-foreground">Add an email for this member first.</p>}
      {state === "error" && error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}

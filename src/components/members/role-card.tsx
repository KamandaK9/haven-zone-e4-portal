"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { updateMemberAccess } from "@/lib/actions/access";
import type { Position } from "@/lib/access";

export type RoleOption = {
  key: string;
  label: string;
  description?: string;
  sees: string;
  can: string[];
  cellRole: boolean;
};

// A member's role and what it means, with "Change role" for whoever may give
// roles below their own (assign_roles / manage_access).
export function RoleCard({
  memberId,
  firstName,
  current,
  options,
  canChange,
  hasLogin,
  cellsHref,
}: {
  memberId: string;
  firstName: string;
  current: RoleOption;
  options: RoleOption[];
  canChange: boolean;
  hasLogin: boolean;
  cellsHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(current.key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choice = options.find((o) => o.key === picked);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await updateMemberAccess({ memberId, position: picked as Position, portfolio: null, granted: [], revoked: [] });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Role: {current.label}
          </CardTitle>
          <CardDescription>{current.description}</CardDescription>
        </div>
        {canChange && (
          <Button variant="outline" size="sm" onClick={() => { setPicked(current.key); setError(null); setOpen(true); }}>
            Change role
          </Button>
        )}
      </CardHeader>
      {(current.can.length > 0 || !hasLogin) && (
        <CardContent className="space-y-2 text-sm">
          {current.can.length > 0 && (
            <p className="text-muted-foreground">
              Sees {current.sees}. Can: {current.can.join(", ").toLowerCase()}.
            </p>
          )}
          {current.can.length > 0 && !hasLogin && (
            <p className="text-amber-700">{firstName} has no login yet — invite them so they can use this role.</p>
          )}
          {current.cellRole && (
            <p className="text-muted-foreground">
              Their cells come from the cells page (the cell they lead, or the one they&apos;re in).{" "}
              <Link href={cellsHref} className="text-primary hover:underline">Open cells</Link>
            </p>
          )}
        </CardContent>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Give {firstName} a role</DialogTitle>
            <DialogDescription>You can give roles below your own. Each role sees only its part of the church.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto py-1">
            {options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setPicked(o.key)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-colors",
                  picked === o.key ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                )}
              >
                <p className="flex items-center gap-2 text-sm font-medium">
                  {picked === o.key && <Check className="h-4 w-4 text-primary" />}
                  {o.label}
                </p>
                {o.description && <p className="mt-0.5 text-xs text-muted-foreground">{o.description}</p>}
                {o.can.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Sees {o.sees} · {o.can.join(" · ")}
                  </p>
                )}
              </button>
            ))}
          </div>
          {choice?.cellRole && (
            <p className="text-xs text-muted-foreground">
              Cell roles cover the cell {firstName} leads (set on the cells page) or belongs to, and any cells inside it.
            </p>
          )}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy || picked === current.key}>{busy ? "Saving…" : "Save role"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

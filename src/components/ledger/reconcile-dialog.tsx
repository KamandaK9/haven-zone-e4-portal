"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scale, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createReconciliation } from "@/lib/actions/reconciliation";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import type { Church, Reconciliation } from "@/lib/data/types";

export function ReconcileDialog({
  church,
  currency,
  rates,
  lastReconciliation,
}: {
  church: Church;
  currency: CurrencyCode;
  rates: Record<string, number>;
  lastReconciliation?: Reconciliation;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [actualBalance, setActualBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ calculatedBalance: number; variance: number } | null>(null);

  function reset() {
    setPeriodEnd(new Date().toISOString().slice(0, 10));
    setActualBalance("");
    setNotes("");
    setError(null);
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await createReconciliation({
      churchId: church.id,
      periodEnd,
      actualBalance: Number(actualBalance),
      notes: notes || undefined,
    });

    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult({ calculatedBalance: res.calculatedBalance, variance: res.variance });
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
          <Scale className="h-3 w-3" />
          Reconcile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>{church.name}</DialogTitle>
              <DialogDescription>As of {new Date(periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className={`rounded-full p-3 ${result.variance === 0 ? "bg-emerald-100" : "bg-amber-100"}`}>
                {result.variance === 0 ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                )}
              </div>
              <p className="font-medium">
                {result.variance === 0
                  ? "Balanced — the books match."
                  : `Off by ${formatMoney(Math.abs(result.variance), currency, rates)} (${result.variance > 0 ? "more than expected" : "less than expected"})`}
              </p>
              <p className="text-xs text-muted-foreground">
                Ledger says {formatMoney(result.calculatedBalance, currency, rates)} — you entered{" "}
                {formatMoney(Number(actualBalance), currency, rates)}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Reconcile {church.name}</DialogTitle>
              <DialogDescription>
                Enter the real balance from your bank statement or cash count — we&apos;ll compare it to what the
                ledger calculates.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {lastReconciliation && (
                <p className="text-xs text-muted-foreground">
                  Last reconciled {new Date(lastReconciliation.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  {" — "}
                  {lastReconciliation.variance === 0 ? "was balanced" : `was off by ${formatMoney(Math.abs(lastReconciliation.variance), currency, rates)}`}
                  {lastReconciliation.reconciledByName ? ` (${lastReconciliation.reconciledByName})` : ""}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="periodEnd">As of</Label>
                <Input id="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="actualBalance">Actual balance (bank statement / cash count)</Label>
                <Input
                  id="actualBalance"
                  type="number"
                  step="0.01"
                  value={actualBalance}
                  onChange={(e) => setActualBalance(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="optional — e.g. explanation for a discrepancy"
                  className="min-h-[60px]"
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !actualBalance}>
                {submitting ? "Checking…" : "Check balance"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

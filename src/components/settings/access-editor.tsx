"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  PORTFOLIOS,
  PORTFOLIO_LABELS,
  POSITIONS,
  POSITION_LABELS,
  canActOn,
  defaultCapabilities,
  effectiveCapabilities,
  type Capability,
  type Portfolio,
  type Position,
} from "@/lib/access";
import { recomputeZoneCapabilities, updateMemberAccess } from "@/lib/actions/access";

const NO_PORTFOLIO = "none";

export function AccessEditDialog({
  memberId,
  name,
  position: initialPosition,
  portfolio: initialPortfolio,
  hasLogin,
  granted,
  revoked,
  actorPosition,
  actorCaps,
}: {
  memberId: string;
  name: string;
  position: Position;
  portfolio: Portfolio | null;
  hasLogin: boolean;
  granted: Capability[];
  revoked: Capability[];
  actorPosition: Position;
  actorCaps: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(initialPortfolio);
  const [desired, setDesired] = useState<Set<Capability>>(
    () => new Set(effectiveCapabilities(initialPosition, initialPortfolio, granted, revoked))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Changing position/portfolio starts from that position's defaults again.
  function pick(nextPosition: Position, nextPortfolio: Portfolio | null) {
    setPosition(nextPosition);
    setPortfolio(nextPortfolio);
    setDesired(new Set(effectiveCapabilities(nextPosition, nextPortfolio)));
  }

  function toggle(cap: Capability, on: boolean) {
    setDesired((d) => {
      const next = new Set(d);
      if (on) next.add(cap);
      else next.delete(cap);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const defaults = new Set(defaultCapabilities(position, portfolio));
    const result = await updateMemberAccess({
      memberId,
      position,
      portfolio,
      granted: CAPABILITIES.filter((c) => desired.has(c) && !defaults.has(c)),
      revoked: CAPABILITIES.filter((c) => !desired.has(c) && defaults.has(c)),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const assignable = POSITIONS.filter((p) => p === "member" || canActOn(actorPosition, p));

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>
            Position sets what they can see and do. Adjust individual permissions below if this person needs more or
            less than the default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Position</Label>
              <Select value={position} onValueChange={(v) => pick(v as Position, portfolio)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assignable.map((p) => (
                    <SelectItem key={p} value={p}>
                      {POSITION_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Portfolio</Label>
              <Select
                value={portfolio ?? NO_PORTFOLIO}
                onValueChange={(v) => pick(position, v === NO_PORTFOLIO ? null : (v as Portfolio))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PORTFOLIO}>None</SelectItem>
                  {PORTFOLIOS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PORTFOLIO_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasLogin ? (
            <div className="space-y-2">
              <Label className="text-xs">Permissions</Label>
              <div className="rounded-lg border divide-y">
                {CAPABILITIES.map((cap) => {
                  const isDefault = defaultCapabilities(position, portfolio).includes(cap);
                  const on = desired.has(cap);
                  const overridden = on !== isDefault;
                  return (
                    <label key={cap} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={on}
                        disabled={!actorCaps.includes(cap)}
                        onCheckedChange={(v) => toggle(cap, v === true)}
                      />
                      <span className="flex-1">{CAPABILITY_LABELS[cap]}</span>
                      {overridden && (
                        <span className="text-[10px] font-medium text-amber-700">{on ? "granted" : "revoked"}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
              No login yet. They get this position&apos;s default permissions when you invite them from their member
              page; you can fine-tune them here afterwards.
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RefreshPermissionsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    const result = await recomputeZoneCapabilities();
    setBusy(false);
    setMessage(result.ok ? "Refreshed." : result.error);
    if (result.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={run} disabled={busy}>
        {busy ? "Refreshing…" : "Refresh permissions"}
      </Button>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}

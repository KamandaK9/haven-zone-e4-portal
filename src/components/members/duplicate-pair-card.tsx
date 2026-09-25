"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, GitMerge } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mergeDuplicateMembers } from "@/lib/actions/members-merge";
import { memberFullName } from "@/lib/data/analytics";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import type { DuplicateReason } from "@/lib/data/duplicates";
import type { Member } from "@/lib/data/types";

const REASON_LABELS: Record<DuplicateReason, string> = {
  "same email": "Same email",
  "same phone": "Same phone",
  "same name in this chapter": "Same name, same chapter",
};

function Side({
  member,
  churchName,
  showGiving,
  currency,
  rates,
  onKeep,
  disabled,
  busy,
}: {
  member: Member;
  churchName: string;
  showGiving: boolean;
  currency: CurrencyCode;
  rates: Record<string, number>;
  onKeep: () => void;
  disabled: boolean;
  busy: boolean;
}) {
  const completed = member.trainings.filter((t) => t.status === "completed").length;
  const totalGiving = member.giving.reduce((sum, g) => sum + g.amount, 0);

  return (
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9 shrink-0">
          <AvatarFallback className="text-xs font-semibold text-white" style={{ backgroundColor: member.avatarColor }}>
            {member.firstName[0]}
            {member.lastName[0]}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{memberFullName(member)}</p>
          <p className="text-xs text-muted-foreground truncate">{churchName}</p>
        </div>
      </div>
      <dl className="text-xs text-muted-foreground space-y-0.5">
        <div className="flex justify-between gap-2">
          <dt>Email</dt>
          <dd className="truncate max-w-[60%] text-foreground">{member.email || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Phone</dt>
          <dd className="text-foreground">{member.phone || "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Trainings</dt>
          <dd className="text-foreground">
            {completed}/{member.trainings.length} complete
          </dd>
        </div>
        {showGiving && (
          <div className="flex justify-between gap-2">
            <dt>Giving</dt>
            <dd className="text-foreground">{formatMoney(totalGiving, currency, rates)}</dd>
          </div>
        )}
        {member.hasPortalAccess && (
          <div className="pt-0.5">
            <Badge variant="secondary" className="font-normal gap-1">
              <CheckCircle2 className="h-3 w-3" /> Has portal login
            </Badge>
          </div>
        )}
      </dl>
      <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={onKeep} disabled={disabled || busy}>
        {busy ? "Merging…" : "Keep this one"}
        {!busy && <ArrowRight className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function DuplicatePairCard({
  a,
  b,
  churchNameA,
  churchNameB,
  reasons,
  showGiving,
  currency,
  rates,
}: {
  a: Member;
  b: Member;
  churchNameA: string;
  churchNameB: string;
  reasons: DuplicateReason[];
  showGiving: boolean;
  currency: CurrencyCode;
  rates: Record<string, number>;
}) {
  const router = useRouter();
  const [busySide, setBusySide] = useState<"a" | "b" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const bothHaveLogins = a.hasPortalAccess && b.hasPortalAccess;

  async function keep(side: "a" | "b") {
    setBusySide(side);
    setError(null);
    const result = await mergeDuplicateMembers(side === "a" ? a.id : b.id, side === "a" ? b.id : a.id);
    setBusySide(null);
    if (!result.ok) return setError(result.error);
    setDismissed(true);
    router.refresh();
  }

  if (dismissed) return null;

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <GitMerge className="h-3.5 w-3.5 text-muted-foreground" />
          {reasons.map((r) => (
            <Badge key={r} variant="secondary" className="font-normal text-[11px]">
              {REASON_LABELS[r]}
            </Badge>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <Side
            member={a}
            churchName={churchNameA}
            showGiving={showGiving}
            currency={currency}
            rates={rates}
            onKeep={() => keep("a")}
            disabled={bothHaveLogins || busySide !== null}
            busy={busySide === "a"}
          />
          <div className="hidden sm:block w-px bg-border shrink-0" />
          <Side
            member={b}
            churchName={churchNameB}
            showGiving={showGiving}
            currency={currency}
            rates={rates}
            onKeep={() => keep("b")}
            disabled={bothHaveLogins || busySide !== null}
            busy={busySide === "b"}
          />
        </div>
        {bothHaveLogins && (
          <p className="flex items-center gap-1.5 text-xs text-amber-700">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Both have their own portal login — sort out which one keeps access from Team &amp; access before merging
            these.
          </p>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

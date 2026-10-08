"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkInChild, releaseChild } from "@/lib/actions/children";
import type { ServiceKey, ServiceKind } from "@/lib/check-in/types";

type Child = { id: string; name: string; guardianName: string; guardianPhone: string };
type CheckIn = { id: string; childName: string; guardianName: string; guardianPhone: string; notes: string; at: string; out: boolean };

const KINDS: { value: ServiceKind; label: string }[] = [
  { value: "sunday", label: "Sunday service" },
  { value: "midweek", label: "Midweek service" },
  { value: "special", label: "Special service" },
];

export function ChildrenDesk({
  churches,
  service,
  today,
  kids,
  checkIns,
  smsReady,
}: {
  churches: { id: string; name: string }[];
  service: ServiceKey;
  today: string;
  kids: Child[];
  checkIns: CheckIn[];
  smsReady: boolean;
}) {
  const router = useRouter();
  const go = (patch: Partial<ServiceKey>) => {
    const s = { ...service, ...patch };
    router.push(`/children?${new URLSearchParams({ church: s.churchId, date: s.date, kind: s.kind })}`);
  };
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Child | null>(null);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [textCode, setTextCode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string; code: string; texted: boolean; note?: string } | null>(null);
  const [releasing, setReleasing] = useState<CheckIn | null>(null);
  const [code, setCode] = useState("");
  const [lost, setLost] = useState(false);
  const [reason, setReason] = useState("");

  const inNow = useMemo(() => new Set(checkIns.map((c) => c.childName)), [checkIns]);
  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return kids.filter((c) => !inNow.has(c.name) && words.every((w) => c.name.toLowerCase().includes(w))).slice(0, 8);
  }, [kids, query, inNow]);
  const here = checkIns.filter((c) => !c.out);
  const gone = checkIns.filter((c) => c.out);

  function pick(c: Child) {
    setPicked(c);
    setGuardianName(c.guardianName);
    setGuardianPhone(c.guardianPhone);
    setNotes("");
    setTextCode(smsReady);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {churches.length > 1 ? (
          <Select value={service.churchId} onValueChange={(v) => go({ churchId: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{churches.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        ) : null}
        <Select value={service.kind} onValueChange={(v) => go({ kind: v as ServiceKind })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={service.date} max={today} onChange={(e) => e.target.value && go({ date: e.target.value })} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Check a child in</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-14 pl-11 text-lg" placeholder="Search the child's name…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {query && (
          <div className="divide-y rounded-xl border">
            {matches.length === 0 && <p className="p-4 text-sm text-muted-foreground">No child by that name who isn&apos;t already here.</p>}
            {matches.map((c) => (
              <button key={c.id} type="button" onClick={() => pick(c)} className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50">
                <span className="text-base font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.guardianName ? `with ${c.guardianName}` : "no guardian on file"}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Here now ({here.length})</p>
        {here.length === 0 ? (
          <p className="text-sm text-muted-foreground">No children checked in yet.</p>
        ) : (
          <div className="divide-y rounded-xl border">
            {here.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-base font-medium">
                    {c.childName}
                    {c.notes && <Badge variant="outline" className="border-amber-300 font-normal text-amber-800">{c.notes}</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.guardianName}{c.guardianPhone ? ` · ${c.guardianPhone}` : ""} · in at {c.at}</p>
                </div>
                <Button variant="outline" className="gap-1.5" onClick={() => { setReleasing(c); setCode(""); setLost(false); setReason(""); setError(null); }}>
                  <KeyRound className="h-4 w-4" /> Release
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {gone.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{gone.length} collected</summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">{gone.map((c) => <li key={c.id}>{c.childName} — {c.guardianName}</li>)}</ul>
        </details>
      )}

      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Check in {picked?.name}</DialogTitle>
            <DialogDescription>Who&apos;s collecting them? They&apos;ll get a code to show when they do.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1"><Label htmlFor="cg-name">Guardian</Label><Input id="cg-name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="cg-phone">Guardian&apos;s phone</Label><Input id="cg-phone" type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="cg-notes">Allergies or anything to know (optional)</Label><Input id="cg-notes" value={notes} maxLength={300} onChange={(e) => setNotes(e.target.value)} /></div>
            {smsReady && guardianPhone.trim() && (
              <label className="flex cursor-pointer items-center gap-3 text-sm"><Checkbox checked={textCode} onCheckedChange={(v) => setTextCode(!!v)} /> Text the code to the guardian</label>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPicked(null)}>Cancel</Button>
            <Button
              disabled={busy || !guardianName.trim()}
              onClick={async () => {
                if (!picked) return;
                setBusy(true);
                const res = await checkInChild({ service, childId: picked.id, childName: picked.name, guardianName, guardianPhone, notes, textCode });
                setBusy(false);
                if (!res.ok) return setError(res.error);
                setResult({ name: picked.name, code: res.code ?? "", texted: !!res.texted, note: res.note });
                setPicked(null);
                setQuery("");
                router.refresh();
              }}
            >
              {busy ? "Checking in…" : "Check in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="text-center sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{result?.name} is checked in</DialogTitle>
            <DialogDescription>Give the guardian this code — they&apos;ll need it to collect them.</DialogDescription>
          </DialogHeader>
          <p className="py-4 font-mono text-6xl font-semibold tracking-[0.2em]">{result?.code}</p>
          {result?.texted && <p className="flex items-center justify-center gap-1 text-sm text-emerald-700"><Check className="h-4 w-4" /> Texted to the guardian too</p>}
          {result?.note && <p className="text-sm text-amber-700">{result.note}</p>}
          <DialogFooter className="sm:justify-center"><Button onClick={() => setResult(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!releasing} onOpenChange={(o) => !o && setReleasing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Release {releasing?.childName}</DialogTitle>
            <DialogDescription>Ask the guardian for the 4-digit code.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Input className="h-16 text-center font-mono text-3xl tracking-[0.3em]" inputMode="numeric" maxLength={4} placeholder="0000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
            {lost ? (
              <Input placeholder="Why? e.g. mother collected, lost her phone (kept on record)" value={reason} onChange={(e) => setReason(e.target.value)} />
            ) : (
              <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setLost(true)}>They don&apos;t have the code</button>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleasing(null)}>Cancel</Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!releasing) return;
                setBusy(true);
                const res = await releaseChild(releasing.id, code, lost ? reason : undefined);
                setBusy(false);
                if (!res.ok) return setError(res.error);
                setReleasing(null);
                router.refresh();
              }}
            >
              {busy ? "Checking…" : "Release"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

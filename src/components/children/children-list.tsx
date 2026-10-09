"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { graduateChild, setGraduation } from "@/lib/actions/children";
import { graduationState, monthLabel } from "@/lib/children/graduation";

export type ChildRow = { id: string; name: string; guardianName: string; guardianPhone: string; birthday: string; expectedGraduation: string };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const birthdayLabel = (mmdd: string) => {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd);
  return m ? new Date(2000, Number(m[1]) - 1, Number(m[2])).toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) : "";
};

// Every child at the location, with who collects them and roughly when they
// move up to the next group.
export function ChildrenList({
  kids,
  churchId,
  today,
  canManage,
  nextGroup,
}: {
  kids: ChildRow[];
  churchId: string;
  today: string;
  canManage: boolean;
  nextGroup?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ChildRow | null>(null);
  const [month, setMonth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [birthMonth, setBirthMonth] = useState("all");
  const [grad, setGrad] = useState("all");
  const [guardian, setGuardian] = useState("all");
  const [sort, setSort] = useState("name");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = kids.filter((k) => {
      if (q && !k.name.toLowerCase().includes(q) && !k.guardianName.toLowerCase().includes(q)) return false;
      if (birthMonth !== "all" && k.birthday.slice(0, 2) !== birthMonth) return false;
      const state = graduationState(k.expectedGraduation, today);
      if (grad === "due" && state !== "soon" && state !== "overdue") return false;
      if (grad === "later" && state !== "later") return false;
      if (grad === "none" && state !== "none") return false;
      if (guardian === "missing" && k.guardianPhone) return false;
      if (guardian === "has" && !k.guardianPhone) return false;
      return true;
    });
    const key = (k: ChildRow) => (sort === "graduation" ? k.expectedGraduation || "9999" : sort === "birthday" ? k.birthday || "99-99" : "");
    return [...list].sort((a, b) => (sort === "name" ? 0 : key(a).localeCompare(key(b))) || a.name.localeCompare(b.name));
  }, [kids, query, birthMonth, grad, guardian, sort, today]);
  const filtering = query !== "" || birthMonth !== "all" || grad !== "all" || guardian !== "all";
  const due = kids
    .filter((k) => ["overdue", "soon"].includes(graduationState(k.expectedGraduation, today)))
    .sort((a, b) => a.expectedGraduation.localeCompare(b.expectedGraduation));

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Couldn't save.");
    setEditing(null);
    router.refresh();
  }

  const graduateButton = (k: ChildRow) =>
    nextGroup ? (
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={busy}
        onClick={() => {
          if (confirm(`Move ${k.name} up to ${nextGroup}?`)) run(() => graduateChild(k.id, churchId));
        }}
      >
        <GraduationCap className="h-3.5 w-3.5" /> Move up to {nextGroup}
      </Button>
    ) : null;

  return (
    <div className="space-y-5">
      {due.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 dark:bg-amber-950/20">
          <p className="text-sm font-medium">Due to move up{nextGroup ? ` to ${nextGroup}` : ""}</p>
          <p className="mb-2 text-xs text-muted-foreground">Around this time, or already past it.</p>
          <ul className="divide-y">
            {due.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm">
                  {k.name} <span className="text-muted-foreground">· {monthLabel(k.expectedGraduation)}</span>
                  {graduationState(k.expectedGraduation, today) === "overdue" && <Badge variant="secondary" className="ml-2">Past due</Badge>}
                </span>
                {canManage && graduateButton(k)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search by child or guardian" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={birthMonth} onValueChange={setBirthMonth}>
          <SelectTrigger className="w-40" aria-label="Birthday month"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any birthday month</SelectItem>
            {MONTHS.map((m, i) => (
              <SelectItem key={m} value={String(i + 1).padStart(2, "0")}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={grad} onValueChange={setGrad}>
          <SelectTrigger className="w-44" aria-label="Moving up"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any graduation</SelectItem>
            <SelectItem value="due">Due or past due</SelectItem>
            <SelectItem value="later">Moving up later</SelectItem>
            <SelectItem value="none">No month set</SelectItem>
          </SelectContent>
        </Select>
        <Select value={guardian} onValueChange={setGuardian}>
          <SelectTrigger className="w-44" aria-label="Guardian"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any guardian</SelectItem>
            <SelectItem value="has">Has a guardian number</SelectItem>
            <SelectItem value="missing">No guardian number</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-44" aria-label="Sort by"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: name</SelectItem>
            <SelectItem value="graduation">Sort: moving up soonest</SelectItem>
            <SelectItem value="birthday">Sort: birthday</SelectItem>
          </SelectContent>
        </Select>
        {filtering && (
          <Button variant="ghost" size="sm" onClick={() => { setQuery(""); setBirthMonth("all"); setGrad("all"); setGuardian("all"); }}>
            Clear filters
          </Button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{kids.length === 0 ? "No children are listed for this location yet." : "No match."}</p>
      ) : (
        <div className="divide-y rounded-xl border">
          {shown.map((k) => {
            const state = graduationState(k.expectedGraduation, today);
            return (
              <div key={k.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.guardianName ? `${k.guardianName}${k.guardianPhone ? ` · ${k.guardianPhone}` : ""}` : "No guardian on record"}
                    {k.birthday && ` · Birthday ${birthdayLabel(k.birthday)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {k.expectedGraduation ? (
                    <Badge variant={state === "later" ? "outline" : "secondary"}>Moves up around {monthLabel(k.expectedGraduation)}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">No graduation month</span>
                  )}
                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(k);
                        setMonth(k.expectedGraduation.slice(0, 7));
                        setError(null);
                      }}
                    >
                      {k.expectedGraduation ? "Change" : "Set"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{filtering ? `${shown.length} of ${kids.length}` : kids.length} {kids.length === 1 ? "child" : "children"}.</p>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
            <DialogDescription>Roughly when they move up{nextGroup ? ` to ${nextGroup}` : ""}. A month is enough.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Graduation month" />
            {editing && graduateButton(editing)}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            {editing?.expectedGraduation && (
              <Button variant="ghost" disabled={busy} onClick={() => editing && run(() => setGraduation(editing.id, null))}>
                Clear
              </Button>
            )}
            <Button disabled={busy || !month} onClick={() => editing && run(() => setGraduation(editing.id, month))}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

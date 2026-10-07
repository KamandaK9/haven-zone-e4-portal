"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, CloudOff, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandMark } from "@/components/brand-mark";
import { tenant } from "@/tenant";
import type { RosterMember, ServiceKey, ServiceKind } from "@/lib/check-in/types";
import { SERVICE_KINDS, remember, todayIn, useCheckIn } from "./use-check-in";

// Self check-in: a tablet at the entrance where people check themselves in.
// A volunteer picks the service once; after that the screen only ever shows
// names someone has typed (never the whole list), confirms "is this you?",
// welcomes them and clears itself. Same offline queue and sync as the
// staffed screen. Leaving kiosk mode takes a 3-second press on the lock.

type Screen =
  | { kind: "search" }
  | { kind: "confirm"; member: RosterMember }
  | { kind: "visitor" }
  | { kind: "welcome"; name: string; already: boolean };

const IDLE_MS = 20_000;
const WELCOME_MS = 3_500;
const firstName = (name: string) => name.split(" ")[0];

export function KioskApp({ churches, timeZone }: { churches: { id: string; name: string }[]; timeZone: string }) {
  const today = useMemo(() => todayIn(timeZone), [timeZone]);
  const [running, setRunning] = useState(false);
  const [churchId, setChurchId] = useState(() => {
    const saved = remember("church");
    return saved && churches.some((c) => c.id === saved) ? saved : (churches[0]?.id ?? "");
  });
  const [service, setService] = useState<Omit<ServiceKey, "churchId">>({
    date: today.date,
    kind: today.isSunday ? "sunday" : "midweek",
    name: "",
  });
  const key: ServiceKey = useMemo(() => ({ churchId, ...service }), [churchId, service]);
  const ci = useCheckIn(key);

  if (!running) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">Self check-in</h1>
          <p className="text-sm text-muted-foreground">
            Set the tablet up for this service, then hand it over — people find their own name and check themselves in.
          </p>
        </div>
        {churches.length > 1 && (
          <Select value={churchId} onValueChange={setChurchId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {churches.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Select value={service.kind} onValueChange={(v) => setService((s) => ({ ...s, kind: v as ServiceKind }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={service.date} max={today.date} onChange={(e) => e.target.value && setService((s) => ({ ...s, date: e.target.value }))} />
          {service.kind !== "sunday" && (
            <Input
              className="col-span-2"
              placeholder="Name of the service (optional)"
              value={service.name}
              onChange={(e) => setService((s) => ({ ...s, name: e.target.value }))}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {ci.roster
            ? `${ci.roster.members.length} members saved on this tablet — works without internet.`
            : ci.online
              ? "Saving the member list…"
              : "No member list on this tablet yet — connect once to save it."}
        </p>
        <Button
          size="lg"
          className="w-full"
          disabled={!ci.roster}
          onClick={() => {
            setRunning(true);
            document.documentElement.requestFullscreen?.().catch(() => {});
          }}
        >
          Start self check-in
        </Button>
      </div>
    );
  }

  return (
    <Kiosk
      title={SERVICE_KINDS.find((k) => k.value === service.kind)?.label ?? "Service"}
      ci={ci}
      onExit={() => {
        setRunning(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }}
    />
  );
}

function Kiosk({ title, ci, onExit }: { title: string; ci: ReturnType<typeof useCheckIn>; onExit: () => void }) {
  const [screen, setScreen] = useState<Screen>({ kind: "search" });
  const [query, setQuery] = useState("");
  const [visitor, setVisitor] = useState({ firstName: "", lastName: "", phone: "" });
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const reset = () => {
    setScreen({ kind: "search" });
    setQuery("");
    setVisitor({ firstName: "", lastName: "", phone: "" });
  };
  // Any screen goes back to a blank search after a while untouched, so the
  // next person never sees the last one's name.
  const touch = () => {
    clearTimeout(idle.current);
    idle.current = setTimeout(reset, IDLE_MS);
  };
  useEffect(() => () => clearTimeout(idle.current), []);
  useEffect(() => {
    if (screen.kind !== "welcome") return;
    const t = setTimeout(reset, WELCOME_MS);
    return () => clearTimeout(t);
  }, [screen]);

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!ci.roster || query.replace(/\s/g, "").length < 2) return [];
    return ci.roster.members.filter((m) => words.every((w) => m.name.toLowerCase().includes(w))).slice(0, 6);
  }, [ci.roster, query]);

  async function confirm(member: RosterMember) {
    const added = await ci.checkIn(member.id);
    setScreen({ kind: "welcome", name: firstName(member.name), already: !added });
  }

  async function addVisitor() {
    if (!visitor.firstName.trim()) return;
    await ci.checkIn(crypto.randomUUID(), visitor);
    setScreen({ kind: "welcome", name: visitor.firstName.trim(), already: false });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background" onPointerDown={touch} onKeyDown={touch}>
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <BrandMark size={40} />
          <div>
            <p className="font-semibold">{tenant.name}</p>
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
        </div>
        <HoldToExit onExit={onExit} />
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pt-6">
        {screen.kind === "search" && (
          <div className="w-full max-w-xl space-y-5">
            <h1 className="text-center text-3xl font-semibold tracking-tight">Welcome! Please check in</h1>
            <Input
              autoFocus
              className="h-16 text-center text-2xl"
              placeholder="Type your name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <div className="space-y-2">
              {matches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setScreen({ kind: "confirm", member: m })}
                  className="flex w-full items-center justify-between rounded-xl border p-4 text-left transition-colors hover:bg-muted active:bg-muted"
                >
                  <span className="text-xl font-medium">{m.name}</span>
                  {m.cell && <span className="text-sm text-muted-foreground">{m.cell}</span>}
                </button>
              ))}
              {query.replace(/\s/g, "").length >= 2 && matches.length === 0 && (
                <p className="text-center text-muted-foreground">We can&apos;t find that name — try your surname, or check in as a first-timer.</p>
              )}
            </div>
            <Button variant="outline" size="lg" className="h-14 w-full gap-2 text-lg" onClick={() => setScreen({ kind: "visitor" })}>
              <UserPlus className="h-5 w-5" /> First time here?
            </Button>
          </div>
        )}

        {screen.kind === "confirm" && (
          <div className="w-full max-w-xl space-y-6 text-center">
            <p className="text-lg text-muted-foreground">Is this you?</p>
            <p className="text-4xl font-semibold">{screen.member.name}</p>
            {screen.member.cell && <p className="text-muted-foreground">{screen.member.cell}</p>}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" size="lg" className="h-16 text-xl" onClick={() => setScreen({ kind: "search" })}>
                No, go back
              </Button>
              <Button size="lg" className="h-16 text-xl" onClick={() => confirm(screen.member)}>
                Yes, check me in
              </Button>
            </div>
          </div>
        )}

        {screen.kind === "visitor" && (
          <form
            className="w-full max-w-xl space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              addVisitor();
            }}
          >
            <h1 className="text-center text-3xl font-semibold tracking-tight">You&apos;re very welcome!</h1>
            <p className="text-center text-muted-foreground">Tell us your name so we can say hello properly.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="k-first">First name</Label>
                <Input id="k-first" className="h-14 text-xl" autoFocus value={visitor.firstName} onChange={(e) => setVisitor({ ...visitor, firstName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="k-last">Surname</Label>
                <Input id="k-last" className="h-14 text-xl" value={visitor.lastName} onChange={(e) => setVisitor({ ...visitor, lastName: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="k-phone">Phone (optional)</Label>
              <Input id="k-phone" type="tel" className="h-14 text-xl" value={visitor.phone} onChange={(e) => setVisitor({ ...visitor, phone: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Your details are kept by {tenant.name} to welcome you and keep in touch. See our privacy notice at /privacy.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" size="lg" className="h-14 text-lg" onClick={() => setScreen({ kind: "search" })}>
                Back
              </Button>
              <Button type="submit" size="lg" className="h-14 text-lg" disabled={!visitor.firstName.trim()}>
                Check me in
              </Button>
            </div>
          </form>
        )}

        {screen.kind === "welcome" && (
          <div className="space-y-4 pt-10 text-center">
            <CheckCircle2 className="mx-auto h-24 w-24 text-emerald-600" />
            <p className="text-4xl font-semibold">Welcome, {screen.name}!</p>
            <p className="text-xl text-muted-foreground">{screen.already ? "You're already checked in." : "You're checked in."}</p>
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between px-6 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          {!ci.online && <CloudOff className="h-3.5 w-3.5" />}
          {ci.online ? "Online" : "Offline — check-ins are saved on this tablet"}
          {ci.queue.length > 0 && ` · ${ci.queue.length} waiting to sync`}
        </span>
        <span>{ci.checkedInCount} checked in</span>
      </footer>
    </div>
  );
}

// Leaving the kiosk takes a 3-second press, so visitors don't wander into
// the app.
function HoldToExit({ onExit }: { onExit: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [holding, setHolding] = useState(false);
  const start = () => {
    setHolding(true);
    timer.current = setTimeout(() => {
      setHolding(false);
      onExit();
    }, 3000);
  };
  const stop = () => {
    setHolding(false);
    clearTimeout(timer.current);
  };
  return (
    <button
      type="button"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground"
      aria-label="Hold for 3 seconds to leave self check-in"
    >
      <Lock className="h-4 w-4" />
      {holding ? "Keep holding…" : "Staff"}
    </button>
  );
}

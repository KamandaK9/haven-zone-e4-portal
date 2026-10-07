"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CloudOff, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrandMark } from "@/components/brand-mark";
import { tenant } from "@/tenant";
import type { RosterMember, ServiceKey, ServiceKind } from "@/lib/check-in/types";
import type { CheckInScreen } from "@/lib/check-in/screen";
import { getSavedBackground, saveBackground } from "@/lib/check-in/store";
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

export function KioskApp({
  churches,
  timeZone,
  screen,
}: {
  churches: { id: string; name: string }[];
  timeZone: string;
  screen: CheckInScreen;
}) {
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
      screen={screen}
      ci={ci}
      onExit={() => {
        setRunning(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }}
    />
  );
}

// Black or white text on the accent colour, whichever reads better.
function onAccent(hex: string): string {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#ffffff";
}

const GREETINGS = ["We're so glad you're here.", "Have a blessed service.", "Great to see you today.", "You're right on time."];

// The background image: fetched fresh while online and kept on the device,
// so the kiosk still looks right offline.
function useBackground(url?: string): string | undefined {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    if (!url) return;
    let objectUrl: string | undefined;
    let cancelled = false;
    const show = (blob: Blob) => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    };
    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        await saveBackground({ url, blob });
        show(blob);
      } catch {
        const saved = await getSavedBackground();
        if (saved) show(saved.blob);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return url ? src : undefined;
}

function Kiosk({
  title,
  screen: look,
  ci,
  onExit,
}: {
  title: string;
  screen: CheckInScreen;
  ci: ReturnType<typeof useCheckIn>;
  onExit: () => void;
}) {
  const [screen, setScreen] = useState<Screen>({ kind: "search" });
  const [query, setQuery] = useState("");
  const [visitor, setVisitor] = useState({ firstName: "", lastName: "", phone: "" });
  const [greeting, setGreeting] = useState(GREETINGS[0]);
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const background = useBackground(look.backgroundUrl);

  const accent = look.accent;
  const accentText = onAccent(accent);
  const dark = look.dark || !!background;
  const fg = dark ? "#ffffff" : "#111111";
  const muted = dark ? "rgba(255,255,255,0.7)" : "rgba(17,17,17,0.6)";
  const glass = dark ? "rgba(255,255,255,0.08)" : "rgba(17,17,17,0.04)";
  const line = dark ? "rgba(255,255,255,0.18)" : "rgba(17,17,17,0.12)";
  const accentButton = { backgroundColor: accent, color: accentText };
  const field = { backgroundColor: glass, borderColor: line, color: fg, "--tw-ring-color": accent } as React.CSSProperties;

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

  const welcome = (name: string, already: boolean) => {
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    setScreen({ kind: "welcome", name, already });
  };

  async function confirm(member: RosterMember) {
    const added = await ci.checkIn(member.id);
    welcome(firstName(member.name), !added);
  }

  async function addVisitor() {
    if (!visitor.firstName.trim()) return;
    await ci.checkIn(crypto.randomUUID(), visitor);
    welcome(visitor.firstName.trim(), false);
  }

  const backdrop: React.CSSProperties = background
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0.85) 100%), url(${background})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : dark
      ? { background: `radial-gradient(ellipse at 50% -10%, ${accent}40 0%, transparent 55%), radial-gradient(ellipse at 50% 120%, ${accent}26 0%, transparent 50%), #0a0a0a` }
      : { background: `radial-gradient(ellipse at 50% -10%, ${accent}26 0%, transparent 55%), #fafafa` };

  return (
    <div className="flex min-h-dvh flex-col" style={{ ...backdrop, color: fg }} onPointerDown={touch} onKeyDown={touch}>
      <header className="flex items-center justify-between px-6 py-4 text-sm" style={{ color: muted }}>
        <span>{title}</span>
        <HoldToExit onExit={onExit} />
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pb-10">
        {screen.kind !== "welcome" && (
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandMark size={88} className="drop-shadow-[0_0_24px_rgba(0,0,0,0.5)]" />
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{look.title}</h1>
            {look.tagline && (
              <div className="mt-3 flex items-center gap-3" style={{ color: accent }}>
                <span className="h-px w-10" style={{ backgroundColor: accent }} />
                <span className="text-sm font-medium uppercase tracking-[0.3em]">{look.tagline}</span>
                <span className="h-px w-10" style={{ backgroundColor: accent }} />
              </div>
            )}
          </div>
        )}

        {screen.kind === "search" && (
          <div className="w-full max-w-xl space-y-4 animate-in fade-in duration-300">
            <p className="text-center text-xl" style={{ color: muted }}>
              Welcome! Type your name to check in.
            </p>
            <input
              autoFocus
              className="h-16 w-full rounded-2xl border px-5 text-center text-2xl outline-none focus:ring-2 placeholder:opacity-50"
              style={field}
              placeholder="Your name"
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
                  className="flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-transform active:scale-[0.98]"
                  style={{ backgroundColor: glass, borderColor: line }}
                >
                  <span className="text-xl font-medium">{m.name}</span>
                  {m.cell && <span className="text-sm" style={{ color: muted }}>{m.cell}</span>}
                </button>
              ))}
              {query.replace(/\s/g, "").length >= 2 && matches.length === 0 && (
                <p className="text-center" style={{ color: muted }}>
                  We can&apos;t find that name — try your surname, or check in as a first-timer.
                </p>
              )}
            </div>
            <button
              type="button"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border text-lg transition-transform active:scale-[0.98]"
              style={{ borderColor: accent, color: accent }}
              onClick={() => setScreen({ kind: "visitor" })}
            >
              <UserPlus className="h-5 w-5" /> First time here?
            </button>
          </div>
        )}

        {screen.kind === "confirm" && (
          <div className="w-full max-w-xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <p className="text-lg" style={{ color: muted }}>
              Is this you?
            </p>
            <p className="text-4xl font-semibold">{screen.member.name}</p>
            {screen.member.cell && <p style={{ color: muted }}>{screen.member.cell}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="h-16 rounded-2xl border text-xl"
                style={{ borderColor: line }}
                onClick={() => setScreen({ kind: "search" })}
              >
                No, go back
              </button>
              <button type="button" className="h-16 rounded-2xl text-xl font-semibold" style={accentButton} onClick={() => confirm(screen.member)}>
                Yes, check me in
              </button>
            </div>
          </div>
        )}

        {screen.kind === "visitor" && (
          <form
            className="w-full max-w-xl space-y-4 animate-in fade-in duration-200"
            onSubmit={(e) => {
              e.preventDefault();
              addVisitor();
            }}
          >
            <h2 className="text-center text-3xl font-semibold tracking-tight">You&apos;re very welcome!</h2>
            <p className="text-center" style={{ color: muted }}>
              Tell us your name so we can greet you properly.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm" style={{ color: muted }}>
                First name
                <input
                  autoFocus
                  className="h-14 w-full rounded-xl border px-4 text-xl outline-none focus:ring-2"
                  style={field}
                  value={visitor.firstName}
                  onChange={(e) => setVisitor({ ...visitor, firstName: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm" style={{ color: muted }}>
                Surname
                <input
                  className="h-14 w-full rounded-xl border px-4 text-xl outline-none focus:ring-2"
                  style={field}
                  value={visitor.lastName}
                  onChange={(e) => setVisitor({ ...visitor, lastName: e.target.value })}
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm" style={{ color: muted }}>
              Phone (optional)
              <input
                type="tel"
                className="h-14 w-full rounded-xl border px-4 text-xl outline-none focus:ring-2"
                style={field}
                value={visitor.phone}
                onChange={(e) => setVisitor({ ...visitor, phone: e.target.value })}
              />
            </label>
            <p className="text-xs" style={{ color: muted }}>
              Your details are kept by {tenant.name} to welcome you and keep in touch — see our privacy notice at /privacy.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className="h-14 rounded-2xl border text-lg" style={{ borderColor: line }} onClick={() => setScreen({ kind: "search" })}>
                Back
              </button>
              <button type="submit" className="h-14 rounded-2xl text-lg font-semibold disabled:opacity-40" style={accentButton} disabled={!visitor.firstName.trim()}>
                Check me in
              </button>
            </div>
          </form>
        )}

        {screen.kind === "welcome" && (
          <div className="flex flex-1 flex-col items-center justify-center space-y-6 text-center">
            <div className="relative animate-in zoom-in-50 fade-in duration-500">
              <div className="absolute inset-0 animate-ping rounded-full opacity-30" style={{ backgroundColor: accent }} />
              <div
                className="relative flex h-32 w-32 items-center justify-center rounded-full"
                style={{ backgroundColor: accent, color: accentText, boxShadow: `0 0 60px ${accent}99` }}
              >
                <Check className="h-16 w-16" strokeWidth={3} />
              </div>
            </div>
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <p className="text-5xl font-semibold tracking-tight sm:text-6xl">Welcome, {screen.name}!</p>
              <p className="text-2xl" style={{ color: muted }}>
                {screen.already ? "You're already checked in — enjoy the service." : greeting}
              </p>
            </div>
            <div className="flex items-center gap-3 pt-4 animate-in fade-in duration-1000" style={{ color: accent }}>
              <BrandMark size={36} />
              <span className="text-sm font-medium uppercase tracking-[0.3em]">{look.tagline || look.title}</span>
            </div>
          </div>
        )}
      </main>

      <footer className="flex items-center justify-between px-6 py-3 text-xs" style={{ color: muted }}>
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

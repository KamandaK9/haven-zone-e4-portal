"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, UserPlus } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { qrAddVisitor, qrCheckIn, type QrResult } from "@/lib/actions/qr-check-in";
import type { CheckInScreen } from "@/lib/check-in/screen";
import { tenant } from "@/tenant";
import { backdropStyle, lookColours } from "./look";

// Checking yourself in on your own phone, from the QR code at church. Same
// look as the self check-in tablet.

type Step =
  | { kind: "phone" }
  | { kind: "choose"; choices: { id: string; firstName: string }[] }
  | { kind: "visitor"; note?: string }
  | { kind: "done"; firstName: string; already: boolean };

const GREETINGS = ["We're so glad you're here.", "Have a blessed service.", "Great to see you today."];

export function QrCheckIn({
  token,
  look,
  service,
}: {
  token: string;
  look: CheckInScreen;
  service?: { title: string; date: string; location: string };
}) {
  const c = lookColours(look, !!look.backgroundUrl);
  const [step, setStep] = useState<Step>({ kind: "phone" });
  const [phone, setPhone] = useState("");
  const [visitor, setVisitor] = useState({ firstName: "", lastName: "" });
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const accentButton = { backgroundColor: c.accent, color: c.accentText };
  const field = { backgroundColor: c.glass, borderColor: c.line, color: c.fg, "--tw-ring-color": c.accent } as React.CSSProperties;

  function handle(r: QrResult) {
    setNote(null);
    switch (r.status) {
      case "checked_in":
      case "already":
        return setStep({ kind: "done", firstName: r.firstName, already: r.status === "already" });
      case "choose":
        return setStep({ kind: "choose", choices: r.choices });
      case "not_found":
        return setNote("We couldn't find that number. Check it and try again — or if you're new, check in as a first-timer.");
      case "known_number":
        setStep({ kind: "phone" });
        return setNote("That number is already ours — check in with it instead.");
      case "expired":
        return setNote("This QR code has expired — please scan the one at church today.");
      case "slow_down":
        return setNote(r.message);
      default:
        return setNote("Something went wrong — please try again.");
    }
  }

  async function run(fn: () => Promise<QrResult>) {
    setBusy(true);
    try {
      handle(await fn());
    } catch {
      setNote("No connection — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ ...backdropStyle(look, look.backgroundUrl), color: c.fg }}>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10 pt-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size={72} />
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{look.title}</h1>
          {look.tagline && (
            <div className="mt-2 flex items-center gap-3" style={{ color: c.accent }}>
              <span className="h-px w-8" style={{ backgroundColor: c.accent }} />
              <span className="text-xs font-medium uppercase tracking-[0.3em]">{look.tagline}</span>
              <span className="h-px w-8" style={{ backgroundColor: c.accent }} />
            </div>
          )}
          {service && (
            <p className="mt-4 text-sm" style={{ color: c.muted }}>
              {service.title} · {service.date}
            </p>
          )}
        </div>

        {!service ? (
          <p className="text-center text-lg" style={{ color: c.muted }}>
            This QR code has expired. Please scan the one at church today.
          </p>
        ) : step.kind === "done" ? (
          <div className="flex flex-1 flex-col items-center justify-center space-y-5 text-center">
            <div className="relative animate-in zoom-in-50 fade-in duration-500">
              <div className="absolute inset-0 animate-ping rounded-full opacity-30" style={{ backgroundColor: c.accent }} />
              <div
                className="relative flex h-24 w-24 items-center justify-center rounded-full"
                style={{ ...accentButton, boxShadow: `0 0 50px ${c.accent}99` }}
              >
                <Check className="h-12 w-12" strokeWidth={3} />
              </div>
            </div>
            <p className="text-4xl font-semibold tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-700">
              Welcome, {step.firstName}!
            </p>
            <p className="text-lg" style={{ color: c.muted }}>
              {step.already ? "You're already checked in — enjoy the service." : greeting}
            </p>
          </div>
        ) : step.kind === "choose" ? (
          <div className="space-y-3">
            <p className="text-center text-lg">Which one are you?</p>
            {step.choices.map((ch) => (
              <button
                key={ch.id}
                type="button"
                disabled={busy}
                onClick={() => run(() => qrCheckIn(token, phone, ch.id))}
                className="w-full rounded-2xl border px-5 py-4 text-left text-xl font-medium"
                style={{ backgroundColor: c.glass, borderColor: c.line }}
              >
                {ch.firstName}
              </button>
            ))}
            <button type="button" className="w-full py-2 text-sm" style={{ color: c.muted }} onClick={() => setStep({ kind: "phone" })}>
              Back
            </button>
          </div>
        ) : step.kind === "visitor" ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => qrAddVisitor(token, { ...visitor, phone }));
            }}
          >
            <p className="text-center text-2xl font-semibold">You&apos;re very welcome!</p>
            <p className="text-center text-sm" style={{ color: c.muted }}>
              Tell us your name so we can greet you properly.
            </p>
            {(["firstName", "lastName"] as const).map((k) => (
              <input
                key={k}
                required={k === "firstName"}
                placeholder={k === "firstName" ? "First name" : "Surname"}
                className="h-14 w-full rounded-xl border px-4 text-lg outline-none focus:ring-2"
                style={field}
                value={visitor[k]}
                onChange={(e) => setVisitor({ ...visitor, [k]: e.target.value })}
              />
            ))}
            <input
              type="tel"
              inputMode="tel"
              placeholder="Phone (optional)"
              className="h-14 w-full rounded-xl border px-4 text-lg outline-none focus:ring-2"
              style={field}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {note && <p className="text-center text-sm" style={{ color: c.accent }}>{note}</p>}
            <button type="submit" disabled={busy || !visitor.firstName.trim()} className="h-14 w-full rounded-2xl text-lg font-semibold disabled:opacity-40" style={accentButton}>
              {busy ? "Checking in…" : "Check me in"}
            </button>
            <p className="text-center text-xs" style={{ color: c.muted }}>
              Your details are kept by {tenant.name} to welcome you and keep in touch —{" "}
              <Link href="/privacy" className="underline">
                privacy notice
              </Link>
              .
            </p>
            <button type="button" className="w-full py-2 text-sm" style={{ color: c.muted }} onClick={() => setStep({ kind: "phone" })}>
              Back
            </button>
          </form>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => qrCheckIn(token, phone));
            }}
          >
            <p className="text-center text-lg" style={{ color: c.muted }}>
              Enter your phone number to check in.
            </p>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              autoFocus
              placeholder="082 123 4567"
              className="h-16 w-full rounded-2xl border px-5 text-center text-2xl tracking-wide outline-none focus:ring-2"
              style={field}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {note && <p className="text-center text-sm" style={{ color: c.accent }}>{note}</p>}
            <button type="submit" disabled={busy || phone.replace(/\D/g, "").length < 9} className="h-14 w-full rounded-2xl text-lg font-semibold disabled:opacity-40" style={accentButton}>
              {busy ? "Checking…" : "Check me in"}
            </button>
            <button
              type="button"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border text-base"
              style={{ borderColor: c.accent, color: c.accent }}
              onClick={() => {
                setNote(null);
                setStep({ kind: "visitor" });
              }}
            >
              <UserPlus className="h-4 w-4" /> First time here?
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

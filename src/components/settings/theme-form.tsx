"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Home, Info, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetTheme, saveTheme } from "@/lib/actions/theme";
import { adviseTheme } from "@/lib/theme/advice";
import { isHex, normaliseHex } from "@/lib/theme/colour";
import { deriveTheme } from "@/lib/theme/derive";
import type { ThemePreset } from "@/lib/theme/presets";
import { cn } from "@/lib/utils";

type Colours = { primary: string; sidebar: string; preset?: string };

function ColourField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  // Follow outside changes (a preset, a suggestion) without an effect.
  if (value !== prev) {
    setPrev(value);
    setText(value);
  }
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} colour picker`}
          value={normaliseHex(value) ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
        />
        <input
          aria-label={`${label} hex code`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const hex = normaliseHex(e.target.value);
            if (hex && isHex(e.target.value.trim().startsWith("#") ? e.target.value.trim() : `#${e.target.value.trim()}`)) onChange(hex);
          }}
          className="h-9 w-28 rounded-md border bg-background px-2 font-mono text-sm"
          maxLength={7}
        />
      </div>
    </div>
  );
}

export function ThemeForm({ presets, current, isSaved }: { presets: readonly ThemePreset[]; current: Colours; isSaved: boolean }) {
  const router = useRouter();
  const [colours, setColours] = useState<Colours>(current);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const derived = useMemo(() => deriveTheme(colours), [colours]);
  const advice = useMemo(() => adviseTheme(colours), [colours]);
  const changed = colours.primary !== current.primary || colours.sidebar !== current.sidebar;

  const set = (patch: Partial<Colours>) => {
    setMessage(null);
    setColours((c) => ({ ...c, ...patch, preset: undefined }));
  };
  const l = derived.light;

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMessage({ ok: true, text: done });
        router.refresh();
      } else setMessage({ ok: false, text: res.error ?? "Couldn't save." });
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Colours</h1>
        <p className="text-sm text-muted-foreground">Two colours set the whole look. The preview and notes update as you choose.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ready-made schemes</CardTitle>
          <CardDescription>Start from one of these, then adjust below if you like.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {presets.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setMessage(null);
                setColours({ primary: p.primary, sidebar: p.sidebar, preset: p.key });
              }}
              className={cn("w-36 rounded-xl border p-2 text-left transition-colors hover:bg-muted/50", colours.preset === p.key && "ring-2 ring-ring")}
              aria-pressed={colours.preset === p.key}
            >
              <span className="flex h-10 overflow-hidden rounded-md">
                <span className="w-1/2" style={{ background: p.sidebar }} />
                <span className="w-1/2" style={{ background: p.primary }} />
              </span>
              <span className="mt-1.5 block text-sm font-medium">{p.label}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your own colours</CardTitle>
          <CardDescription>Pick any colour with the swatch, or type its hex code.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <ColourField label="Nav bar" hint="The side menu's background. Deep colours work best." value={colours.sidebar} onChange={(hex) => set({ sidebar: hex })} />
          <ColourField label="Brand colour" hint="Buttons, links, icons and charts." value={colours.primary} onChange={(hex) => set({ primary: hex })} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>This is how it will look. Labels point at where each colour is used.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex overflow-hidden rounded-xl border bg-white text-[#14110d]" aria-hidden>
            <div className="w-44 shrink-0 space-y-1 p-3" style={{ background: l.sidebar, color: l["sidebar-foreground"] }}>
              <p className="px-2 pb-2 text-xs font-semibold opacity-80">NAV BAR</p>
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium" style={{ background: l["sidebar-accent"], color: l["sidebar-accent-foreground"] }}>
                <Home className="h-4 w-4" style={{ color: l["sidebar-primary"] }} /> Dashboard
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <Users className="h-4 w-4 opacity-70" /> Members
              </div>
              <p className="px-2 pt-2 text-[11px] opacity-70">Highlighted item and its icon use {derived.bright}</p>
            </div>
            <div className="min-w-0 flex-1 space-y-3 p-4">
              <p className="text-sm font-semibold">Welcome back</p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md px-3 py-1.5 text-sm font-medium" style={{ background: l.primary, color: l["primary-foreground"] }}>
                  Button
                </span>
                <span className="text-sm font-medium underline" style={{ color: l.primary }}>
                  A link
                </span>
                <Users className="h-5 w-5" style={{ color: l.primary }} />
              </div>
              <div className="flex h-12 items-end gap-1">
                {[0.4, 0.7, 0.55, 0.9, 0.65].map((h, i) => (
                  <span key={i} className="w-6 rounded-t" style={{ height: `${h * 100}%`, background: l["brand-chart"] }} />
                ))}
                <span className="ml-2 text-[11px] text-muted-foreground">Charts</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it reads</CardTitle>
          <CardDescription>Notes on whether people will be able to see and read each part comfortably.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {advice.map((a) => (
            <div key={a.area} className="flex items-start gap-3 rounded-lg border p-3">
              {a.level === "good" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              ) : a.level === "ok" ? (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{a.area}</p>
                <p className="text-sm text-muted-foreground">{a.message}</p>
              </div>
              {a.fix && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2"
                  onClick={() => set({ [a.fix!.field]: a.fix!.hex })}
                >
                  <span className="h-3 w-3 rounded-full border" style={{ background: a.fix.hex }} />
                  {a.fix.label}
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || (isSaved && !changed)} onClick={() => run(() => saveTheme(colours), "Colours saved.")}>
          {pending ? "Saving…" : "Save colours"}
        </Button>
        {isSaved && (
          <Button variant="ghost" disabled={pending} onClick={() => run(resetTheme, "Back to the default look.")}>
            Reset to default
          </Button>
        )}
        {message && <p className={cn("text-sm", message.ok ? "text-emerald-700" : "text-red-600")}>{message.text}</p>}
      </div>
    </div>
  );
}

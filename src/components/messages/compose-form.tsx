"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Info, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createMessage, previewAudience, type AudiencePreview } from "@/lib/actions/messages";
import { smsSegments } from "@/lib/messaging/text";
import type { Audience } from "@/lib/messaging/audience";

type Option = { id: string; name: string };
const ANY = "any";

export function ComposeForm({
  churches,
  cells,
  departments,
  ageGroups,
  canApprove,
  smsReady,
  emailReady,
  labels,
}: {
  churches: Option[];
  cells: Option[];
  departments: Option[];
  ageGroups: { key: string; label: string }[];
  canApprove: boolean;
  smsReady: boolean;
  emailReady: boolean;
  labels: { location: string; cell: string };
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [church, setChurch] = useState(ANY);
  const [cell, setCell] = useState(ANY);
  const [age, setAge] = useState(ANY);
  const [department, setDepartment] = useState(ANY);
  const [who, setWho] = useState<"everyone" | "firstTimers" | "workers">("everyone");
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);

  const audience: Audience = useMemo(
    () => ({
      ...(church !== ANY ? { churchId: church } : {}),
      ...(cell !== ANY ? { cellId: cell } : {}),
      ...(age !== ANY ? { ageGroup: age } : {}),
      ...(department !== ANY ? { departmentId: department } : {}),
      ...(who === "firstTimers" ? { firstTimers: true } : {}),
      ...(who === "workers" ? { workers: true } : {}),
    }),
    [church, cell, age, department, who]
  );

  // Who it reaches, refreshed shortly after the last change.
  useEffect(() => {
    if (!body.trim()) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setPreviewing(true);
      const res = await previewAudience({ channel, subject, body, audience }).catch(() => null);
      if (cancelled) return;
      setPreview(res);
      setPreviewing(false);
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [channel, body, audience, subject]);

  const seg = smsSegments(body);
  const ready = channel === "sms" ? smsReady : emailReady;

  function insertTag(tag: string) {
    const el = textarea.current;
    if (!el) return setBody((b) => `${b}{${tag}}`);
    const { selectionStart: a, selectionEnd: z } = el;
    setBody(body.slice(0, a) + `{${tag}}` + body.slice(z));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + tag.length + 2, a + tag.length + 2);
    });
  }

  function send() {
    setError(null);
    start(async () => {
      const res = await createMessage({ channel, subject, body, audience });
      if (!res.ok) return setError(res.error);
      router.push(`/messages/${res.id}`);
    });
  }

  const select = (label: string, value: string, set: (v: string) => void, all: string, options: { value: string; label: string }[]) =>
    options.length === 0 ? null : (
      <div className="space-y-1">
        <Label className="text-xs">{label}</Label>
        <Select value={value} onValueChange={set}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{all}</SelectItem>
            {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <div className="inline-flex rounded-lg border p-0.5">
          {(["sms", "email"] as const).map((c) => (
            <button key={c} type="button" onClick={() => setChannel(c)} className={cn("rounded-md px-4 py-1.5 text-sm", channel === c ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {c === "sms" ? "Text (SMS)" : "Email"}
            </button>
          ))}
        </div>

        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">Who is it for?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {select(labels.location, church, setChurch, `Every ${labels.location.toLowerCase()} I can see`, churches.map((c) => ({ value: c.id, label: c.name })))}
            {select(labels.cell, cell, setCell, `Every ${labels.cell.toLowerCase()}`, cells.map((c) => ({ value: c.id, label: c.name })))}
            {select("Age group", age, setAge, "All ages", ageGroups.map((g) => ({ value: g.key, label: g.label })))}
            {select("Department", department, setDepartment, "Any department", departments.map((d) => ({ value: d.id, label: d.name })))}
          </div>
          <div className="flex flex-wrap gap-2">
            {([["everyone", "Everyone"], ["firstTimers", "First-timers only"], ["workers", "Workers only"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setWho(k)} className={cn("rounded-full border px-3 py-1 text-xs", who === k ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {channel === "email" && (
            <div className="space-y-1">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" ref={textarea} rows={channel === "sms" ? 5 : 9} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="Hi {first_name}, …" />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                Insert:
                {(["first_name", "name"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => insertTag(t)} className="rounded border px-1.5 py-0.5 hover:bg-muted">{`{${t}}`}</button>
                ))}
              </span>
              {channel === "sms" && (
                <span>
                  {seg.length} characters · {seg.segments} text{seg.segments === 1 ? "" : "s"} each{seg.unicode ? " (emoji or special characters make texts shorter)" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-medium">What will happen</p>
          {!body.trim() ? (
            <p className="text-sm text-muted-foreground">Write your message to see who it reaches.</p>
          ) : !preview ? (
            <p className="text-sm text-muted-foreground">{previewing ? "Checking…" : "—"}</p>
          ) : !preview.ok ? (
            <p className="text-sm text-red-600">{preview.error}</p>
          ) : (
            <div className={cn("space-y-2 text-sm", previewing && "opacity-60")}>
              <p><span className="text-2xl font-semibold tabular-nums">{preview.count}</span> <span className="text-muted-foreground">people will get it</span></p>
              {preview.toGuardians > 0 && <p className="text-xs text-muted-foreground">{preview.toGuardians} of them are children — it goes to their guardian.</p>}
              {preview.matched - preview.count > 0 && (
                <p className="text-xs text-muted-foreground">
                  {preview.matched - preview.count} left out:{" "}
                  {[
                    preview.skipped.noContact && `${preview.skipped.noContact} with no ${channel === "sms" ? "number" : "email"}`,
                    preview.skipped.noGuardian && `${preview.skipped.noGuardian} children with no guardian ${channel === "sms" ? "number" : "contact"}`,
                    preview.skipped.optedOut && `${preview.skipped.optedOut} opted out`,
                    preview.skipped.duplicate && `${preview.skipped.duplicate} sharing a number`,
                  ].filter(Boolean).join(", ")}
                </p>
              )}
              {channel === "sms" && (
                <p className="text-xs text-muted-foreground">
                  {preview.segments.toLocaleString()} texts ≈ US${preview.estimatedCost.toFixed(2)}
                  {preview.remaining !== null && ` · ${preview.remaining.toLocaleString()} left this month`}
                </p>
              )}
              {preview.overCap && (
                <p className="flex items-start gap-1.5 text-xs text-red-700"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> More than this month&apos;s cap — it won&apos;t send until the cap is raised or next month.</p>
              )}
              {preview.sample && (
                <div className="rounded-lg bg-muted/50 p-3 text-xs">
                  <p className="mb-1 text-muted-foreground">How it looks:</p>
                  <p className="whitespace-pre-wrap">{preview.sample}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {!ready && (
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {channel === "sms" ? "Texts" : "Email"} aren&apos;t connected yet — it will be saved and sent once they are.
          </p>
        )}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        <Button className="w-full gap-2" disabled={pending || !body.trim() || (preview?.ok === true && preview.count === 0)} onClick={send}>
          <Send className="h-4 w-4" /> {pending ? "Working…" : canApprove ? (ready ? "Send now" : "Save — sends when connected") : "Submit for approval"}
        </Button>
        {!canApprove && <p className="text-center text-xs text-muted-foreground">A pastor approves it, then it goes out.</p>}
      </aside>
    </div>
  );
}

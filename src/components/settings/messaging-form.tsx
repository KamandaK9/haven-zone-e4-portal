"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveMessagingSettings, type SettingsInput } from "@/lib/actions/messages";

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-primary" : "bg-muted-foreground/30")}
    >
      <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function MessagingSettingsForm({ initial, digestAvailable }: { initial: SettingsInput; digestAvailable: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof SettingsInput>(k: K, value: SettingsInput[K]) => {
    setV((s) => ({ ...s, [k]: value }));
    setMessage(null);
  };

  const automation = (
    key: "birthdayEnabled" | "welcomeEnabled" | "missedEnabled" | "digestEnabled",
    title: string,
    description: string,
    templates: { key: "birthdayTemplate" | "birthdayGuardianTemplate" | "welcomeTemplate" | "missedTemplate"; label: string }[]
  ) => (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Toggle on={v[key]} onChange={(x) => set(key, x)} label={title} />
      </div>
      {templates.map((t) => (
        <div key={t.key} className="space-y-1">
          <Label className="text-xs">{t.label}</Label>
          <Textarea rows={3} value={v[t.key]} onChange={(e) => set(t.key, e.target.value)} />
        </div>
      ))}
    </div>
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveMessagingSettings(v);
          setMessage(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error });
          if (res.ok) router.refresh();
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="cap">Texts allowed per month</Label>
          <Input id="cap" type="number" min={0} value={v.monthlySmsCap} onChange={(e) => set("monthlySmsCap", Math.round(Number(e.target.value)))} />
          <p className="text-xs text-muted-foreground">Sending stops here, so a mistake can&apos;t run up a bill.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cost">One text costs (US$)</Label>
          <Input id="cost" type="number" step="0.001" min={0} value={v.smsCostEstimate} onChange={(e) => set("smsCostEstimate", Number(e.target.value))} />
          <p className="text-xs text-muted-foreground">From Twilio&apos;s price list — only used for the estimate.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="footer">Added to every text</Label>
          <Input id="footer" value={v.smsFooter} maxLength={80} onChange={(e) => set("smsFooter", e.target.value)} />
          <p className="text-xs text-muted-foreground">Keep &ldquo;Reply STOP to opt out&rdquo; so people can.</p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">Automatic messages</p>
        <p className="text-xs text-muted-foreground">
          All off until you turn them on. Use {"{first_name}"}, {"{name}"} and {"{church}"} in the wording. Children&apos;s messages always go to their guardian.
        </p>
      </div>
      {automation("birthdayEnabled", "Birthdays", "Each morning, a batch of today's birthdays is made and waits for a pastor's approval before it goes out.", [
        { key: "birthdayTemplate", label: "To the person" },
        { key: "birthdayGuardianTemplate", label: "To a child's guardian (also {guardian_name})" },
      ])}
      {automation("welcomeEnabled", "Welcome first-timers", "The morning after someone checks in as a first-timer, they get a welcome text.", [{ key: "welcomeTemplate", label: "Welcome text" }])}
      {automation("missedEnabled", "We missed you", "When someone misses two Sundays in a row (and no one has already followed up), they get a kind text.", [{ key: "missedTemplate", label: "Text" }])}
      {digestAvailable &&
        automation("digestEnabled", "Monday summary for pastors", "Each Monday, every pastor gets an email: last Sunday's attendance, new first-timers and who needs a follow-up in their area.", [])}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        {message && (
          <span className={cn("flex items-center gap-1 text-sm", message.ok ? "text-emerald-700" : "text-red-700")}>
            {message.ok && <Check className="h-4 w-4" />} {message.text}
          </span>
        )}
      </div>
    </form>
  );
}

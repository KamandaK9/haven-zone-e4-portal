"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateLegalSettings } from "@/lib/actions/privacy";
import type { LegalConfig } from "@/lib/tenant";

const isPlaceholder = (v?: string) => !!v && /\[[^\]]+\]/.test(v);
// Placeholders show as empty fields with the hint as the placeholder text.
const value = (v?: string) => (isPlaceholder(v) ? "" : (v ?? ""));
const hint = (v?: string, fallback = "") => (isPlaceholder(v) ? v!.replace(/^\[|\]$/g, "") : fallback);

const RETENTION: { key: keyof LegalConfig["retention"]; label: string }[] = [
  { key: "membersAfterLeaving", label: "Member details, after someone leaves" },
  { key: "financial", label: "Giving and financial records" },
  { key: "auditLog", label: "Leaders' audit log" },
  { key: "supportAndRequests", label: "Help and privacy requests, after closing" },
];

export function LegalSettingsForm({ legal }: { legal: LegalConfig }) {
  const router = useRouter();
  const [form, setForm] = useState({
    organisationName: value(legal.organisationName),
    physicalAddress: value(legal.physicalAddress),
    io: { name: value(legal.informationOfficer.name), email: value(legal.informationOfficer.email), phone: legal.informationOfficer.phone ?? "" },
    hasDeputy: !!legal.deputyInformationOfficer,
    deputy: {
      name: value(legal.deputyInformationOfficer?.name),
      email: value(legal.deputyInformationOfficer?.email),
      phone: legal.deputyInformationOfficer?.phone ?? "",
    },
    operators: legal.operators.map((o) => ({ name: o.name, purpose: o.purpose, location: value(o.location), locationHint: hint(o.location, "e.g. Frankfurt, Germany") })),
    retention: { ...legal.retention },
    republish: false,
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => {
    setSaved(false);
    setForm((f) => ({ ...f, ...patch }));
  };
  const contact = (c: { name: string; email: string; phone: string }) => ({ name: c.name, email: c.email, ...(c.phone.trim() ? { phone: c.phone } : {}) });

  async function save() {
    setBusy(true);
    setError(null);
    const result = await updateLegalSettings({
      organisationName: form.organisationName,
      physicalAddress: form.physicalAddress,
      informationOfficer: contact(form.io),
      deputyInformationOfficer: form.hasDeputy ? contact(form.deputy) : null,
      operators: form.operators.map(({ name, purpose, location }) => ({ name, purpose, location })),
      retention: form.retention,
      republish: form.republish,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setForm((f) => ({ ...f, republish: false }));
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="lg-org">Registered name</Label>
          <Input id="lg-org" value={form.organisationName} placeholder={hint(legal.organisationName)} onChange={(e) => set({ organisationName: e.target.value })} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="lg-addr">Physical address</Label>
          <Textarea id="lg-addr" rows={2} value={form.physicalAddress} placeholder={hint(legal.physicalAddress)} onChange={(e) => set({ physicalAddress: e.target.value })} />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Information Officer</legend>
        <p className="text-xs text-muted-foreground">The head of the organisation, unless the role is delegated in writing. Must also be registered with the Information Regulator.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input aria-label="Information Officer's name" placeholder="Name" value={form.io.name} onChange={(e) => set({ io: { ...form.io, name: e.target.value } })} />
          <Input aria-label="Information Officer's email" type="email" placeholder="Email" value={form.io.email} onChange={(e) => set({ io: { ...form.io, email: e.target.value } })} />
          <Input aria-label="Information Officer's phone" placeholder="Phone (optional)" value={form.io.phone} onChange={(e) => set({ io: { ...form.io, phone: e.target.value } })} />
        </div>
        <label className="flex items-center gap-2 pt-1 text-sm">
          <Checkbox checked={form.hasDeputy} onCheckedChange={(v) => set({ hasDeputy: v === true })} />
          There&apos;s a Deputy Information Officer
        </label>
        {form.hasDeputy && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Input aria-label="Deputy's name" placeholder="Name" value={form.deputy.name} onChange={(e) => set({ deputy: { ...form.deputy, name: e.target.value } })} />
            <Input aria-label="Deputy's email" type="email" placeholder="Email" value={form.deputy.email} onChange={(e) => set({ deputy: { ...form.deputy, email: e.target.value } })} />
            <Input aria-label="Deputy's phone" placeholder="Phone (optional)" value={form.deputy.phone} onChange={(e) => set({ deputy: { ...form.deputy, phone: e.target.value } })} />
          </div>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Service providers that handle the data</legend>
        <p className="text-xs text-muted-foreground">Everyone who processes members&apos; information for you, and where. Shown in the privacy notice.</p>
        <ul className="space-y-2">
          {form.operators.map((o, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_12rem_auto]">
              <Input aria-label="Provider" placeholder="Provider" value={o.name} onChange={(e) => set({ operators: form.operators.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <Input aria-label="What they do" placeholder="What they do" value={o.purpose} onChange={(e) => set({ operators: form.operators.map((x, j) => (j === i ? { ...x, purpose: e.target.value } : x)) })} />
              <Input aria-label="Where" placeholder={o.locationHint} value={o.location} onChange={(e) => set({ operators: form.operators.map((x, j) => (j === i ? { ...x, location: e.target.value } : x)) })} />
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${o.name || "provider"}`} onClick={() => set({ operators: form.operators.filter((_, j) => j !== i) })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => set({ operators: [...form.operators, { name: "", purpose: "", location: "", locationHint: "e.g. United States" }] })}>
          <Plus className="h-3.5 w-3.5" /> Add a provider
        </Button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How long records are kept (years)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {RETENTION.map((r) => (
            <label key={r.key} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span>{r.label}</span>
              <Input
                type="number"
                min={0}
                max={100}
                step={1}
                className="h-8 w-20 tabular-nums"
                value={form.retention[r.key]}
                onChange={(e) => set({ retention: { ...form.retention, [r.key]: Number(e.target.value) } })}
              />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-2.5 rounded-lg border p-3 text-sm">
        <Checkbox checked={form.republish} onCheckedChange={(v) => set({ republish: v === true })} className="mt-0.5" />
        <span>
          <span className="font-medium">Ask everyone to accept the updated notice</span>
          <span className="block text-xs text-muted-foreground">
            For a change in substance (e.g. a new provider, a new country, longer retention). Currently version {legal.privacyNoticeVersion}. Fixing a typo or a phone number doesn&apos;t need this.
          </span>
        </span>
      </label>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save privacy details"}</Button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Saved — the privacy notice is updated
          </span>
        )}
      </div>
    </div>
  );
}

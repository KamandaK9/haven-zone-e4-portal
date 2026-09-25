"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateHandbookRules } from "@/lib/actions/handbook";
import { validateRules } from "@/lib/handbook/rules";
import type { HandbookRules } from "@/lib/handbook/types";

type Field = { key: string; label: string; money?: boolean };
type Row = { id: string; label: string; values: Record<string, number>; defaults: Record<string, number> };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function RulesTable({ fields, rows, onChange }: { fields: Field[]; rows: Row[]; onChange: (rowIndex: number, key: string, value: number) => void }) {
  return (
    <div className="divide-y rounded-lg border">
      <div className="hidden gap-3 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid" style={{ gridTemplateColumns: `minmax(0,1fr) repeat(${fields.length}, 8.5rem)` }}>
        <span>Category</span>
        {fields.map((f) => (
          <span key={f.key}>{f.label}</span>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={row.id}
          className="grid grid-cols-2 items-start gap-3 px-3 py-2.5 sm:[grid-template-columns:var(--cols)]"
          style={{ "--cols": `minmax(0,1fr) repeat(${fields.length}, 8.5rem)` } as React.CSSProperties}
        >
          <span className="col-span-2 pt-1.5 text-sm font-medium sm:col-span-1">{row.label}</span>
          {fields.map((f) => {
            const value = row.values[f.key];
            const changed = value !== row.defaults[f.key];
            return (
              <label key={f.key} className="space-y-0.5">
                <span className="text-xs text-muted-foreground sm:sr-only">{f.label}</span>
                <div className="relative">
                  {f.money && <span className="pointer-events-none absolute left-2.5 top-1.5 text-sm text-muted-foreground">$</span>}
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={1}
                    value={Number.isFinite(value) ? value : ""}
                    onChange={(e) => onChange(i, f.key, e.target.value === "" ? NaN : Number(e.target.value))}
                    className={f.money ? "h-8 pl-5 tabular-nums" : "h-8 tabular-nums"}
                    aria-label={`${row.label} — ${f.label}`}
                  />
                </div>
                {changed && (
                  <span className="block text-[11px] text-muted-foreground">
                    Default {f.money ? usd.format(row.defaults[f.key]) : row.defaults[f.key]}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function HandbookRulesForm({
  defaults,
  current,
  customised,
  sourceName,
}: {
  defaults: HandbookRules;
  current: HandbookRules;
  customised: boolean;
  sourceName: string;
}) {
  const router = useRouter();
  const [rules, setRules] = useState(current);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(rules) !== JSON.stringify(current), [rules, current]);
  const problem = useMemo(() => (dirty ? validateRules(rules) : null), [dirty, rules]);

  function edit(mutate: (draft: HandbookRules) => void) {
    setSaved(false);
    setError(null);
    setRules((prev) => {
      const draft = structuredClone(prev);
      mutate(draft);
      return draft;
    });
  }

  async function save(next: HandbookRules | null) {
    setSaving(true);
    setError(null);
    const result = await updateHandbookRules(next);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!next) setRules(defaults);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="chapter">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="chapter">Chapters</TabsTrigger>
          <TabsTrigger value="zone">Zones</TabsTrigger>
          <TabsTrigger value="member">Membership cards</TabsTrigger>
          <TabsTrigger value="governorship">Chapter leadership</TabsTrigger>
        </TabsList>
        <TabsContent value="chapter" className="pt-2">
          <RulesTable
            fields={[
              { key: "minAmount", label: "Min. giving / year", money: true },
              { key: "minMembers", label: "Min. members" },
            ]}
            rows={rules.chapter.map((r, i) => ({
              id: r.code,
              label: r.label,
              values: { minAmount: r.minAmount, minMembers: r.minMembers },
              defaults: { minAmount: defaults.chapter[i].minAmount, minMembers: defaults.chapter[i].minMembers },
            }))}
            onChange={(i, key, v) => edit((d) => void ((d.chapter[i] as Record<string, unknown>)[key] = v))}
          />
        </TabsContent>
        <TabsContent value="zone" className="pt-2">
          <RulesTable
            fields={[
              { key: "minAmount", label: "Min. giving / year", money: true },
              { key: "minChapters", label: "Min. chapters" },
              { key: "minMembers", label: "Min. members" },
            ]}
            rows={rules.zone.map((r, i) => ({
              id: r.code,
              label: r.label,
              values: { minAmount: r.minAmount, minChapters: r.minChapters, minMembers: r.minMembers },
              defaults: {
                minAmount: defaults.zone[i].minAmount,
                minChapters: defaults.zone[i].minChapters,
                minMembers: defaults.zone[i].minMembers,
              },
            }))}
            onChange={(i, key, v) => edit((d) => void ((d.zone[i] as Record<string, unknown>)[key] = v))}
          />
        </TabsContent>
        <TabsContent value="member" className="pt-2">
          <RulesTable
            fields={[{ key: "minAmount", label: "Min. giving / year", money: true }]}
            rows={rules.member.rungs.map((r, i) => ({
              id: r.code,
              label: r.label,
              values: { minAmount: r.minAmount },
              defaults: { minAmount: defaults.member.rungs[i].minAmount },
            }))}
            onChange={(i, _key, v) => edit((d) => void (d.member.rungs[i].minAmount = v))}
          />
          {rules.member.rankTier && (
            <p className="mt-2 text-xs text-muted-foreground">
              {rules.member.rankTier.label} isn&apos;t set by amount — it goes to the top {rules.member.rankTier.topN} partners for{" "}
              {rules.member.rankTier.years} consecutive years.
            </p>
          )}
        </TabsContent>
        <TabsContent value="governorship" className="pt-2">
          <RulesTable
            fields={[{ key: "minAmount", label: "Min. giving / year", money: true }]}
            rows={rules.governorship.map((r, i) => ({
              id: r.title,
              label: r.title,
              values: { minAmount: r.minAmount },
              defaults: { minAmount: defaults.governorship[i].minAmount },
            }))}
            onChange={(i, _key, v) => edit((d) => void (d.governorship[i].minAmount = v))}
          />
        </TabsContent>
      </Tabs>

      {(problem || error) && <p className="text-sm text-destructive">{problem ?? error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => save(rules)} disabled={!dirty || !!problem || saving}>
          {saving ? "Saving…" : "Save thresholds"}
        </Button>
        {dirty && (
          <Button size="sm" variant="ghost" onClick={() => setRules(current)} disabled={saving}>
            Discard changes
          </Button>
        )}
        {customised && !dirty && (
          <Button size="sm" variant="outline" onClick={() => save(null)} disabled={saving}>
            Reset to {sourceName} defaults
          </Button>
        )}
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-600">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
    </div>
  );
}

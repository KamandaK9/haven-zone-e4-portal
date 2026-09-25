import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { HandbookLive } from "@/lib/handbook/live";
import { cn, pluralize } from "@/lib/utils";

export type LiveFormat = {
  // Live amounts, in the zone's display currency.
  money: (usd: number) => string;
  // Link to this page for another year, landing back on the given section.
  yearHref: (year: number, sectionId: string) => string;
};

function YearPicker({ live, sectionId, fmt }: { live: HandbookLive; sectionId: string; fmt: LiveFormat }) {
  const years = live.years.slice(0, 6);
  if (years.length < 2) return null;
  return (
    <nav aria-label="Year" className="flex flex-wrap gap-1">
      {years.map((y) => (
        <Link
          key={y}
          href={fmt.yearHref(y, sectionId)}
          scroll={false}
          aria-current={y === live.year ? "true" : undefined}
          className={cn(
            "rounded-md px-2 py-0.5 text-xs tabular-nums transition-colors",
            y === live.year ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {y}
        </Link>
      ))}
    </nav>
  );
}

function yearNote(live: HandbookLive) {
  return live.year === live.currentYear ? `${live.year} so far` : String(live.year);
}

function pct(value: number, target: number) {
  return target <= 0 ? 100 : Math.min(100, Math.round((value / target) * 100));
}

export function ChapterStandings({ live, sectionId, fmt }: { live: HandbookLive; sectionId: string; fmt: LiveFormat }) {
  if (!live.chapters) return null;
  const counts = new Map<string, number>();
  for (const c of live.chapters) {
    const key = c.placement.rung?.label ?? "Uncategorised";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Where your chapters stand</CardTitle>
          <CardDescription>Based on {yearNote(live)} giving and current membership</CardDescription>
        </div>
        <YearPicker live={live} sectionId={sectionId} fmt={fmt} />
      </CardHeader>
      <CardContent className="space-y-4">
        {live.chapters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chapters to show yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {[...counts].map(([label, n]) => (
                <span key={label} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                  {label}: <span className="font-semibold tabular-nums">{n}</span>
                </span>
              ))}
            </div>
            <ul className="divide-y rounded-lg border">
              {live.chapters.map((c) => {
                const { rung, next, gap } = c.placement;
                const needs = gap
                  ? [gap.amount > 0 && `${fmt.money(gap.amount)} more`, gap.members > 0 && pluralize(gap.members, "more member")].filter(Boolean)
                  : [];
                return (
                  <li key={c.id} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,14rem)] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmt.money(c.amount)} · {pluralize(c.members, "member")}
                      </p>
                    </div>
                    <div>
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          rung ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {rung?.label ?? "Uncategorised"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {next ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            To {next.label}: {needs.join(" and ")}
                          </p>
                          {/* The furthest-behind requirement is what's holding the chapter back. */}
                          <Progress
                            value={Math.min(pct(c.amount, next.minAmount), pct(c.members, next.minMembers))}
                            aria-label={`Progress to ${next.label}`}
                          />
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">Top category</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Giving is counted by calendar year. Membership is everyone on the chapter&apos;s roll in the portal today, not only bona fide
          (fully paid-up) members.
        </p>
      </CardContent>
    </Card>
  );
}

export function ZoneStanding({
  live,
  zoneName,
  sectionId,
  fmt,
}: {
  live: HandbookLive;
  zoneName: string;
  sectionId: string;
  fmt: LiveFormat;
}) {
  if (!live.zone) return null;
  const { amount, members, chapters, placement } = live.zone;
  const { rung, next, gap } = placement;
  const rows = next
    ? [
        { label: "Giving", have: fmt.money(amount), need: fmt.money(next.minAmount), short: gap!.amount > 0, value: pct(amount, next.minAmount) },
        { label: "Chapters", have: String(chapters), need: String(next.minChapters), short: gap!.chapters > 0, value: pct(chapters, next.minChapters) },
        { label: "Members", have: String(members), need: String(next.minMembers), short: gap!.members > 0, value: pct(members, next.minMembers) },
      ]
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>
            {zoneName}: {rung?.label ?? "Uncategorised"}
          </CardTitle>
          <CardDescription>
            Based on {yearNote(live)} giving{rung && "note" in rung && rung.note ? ` · ${rung.note}` : ""}
          </CardDescription>
        </div>
        <YearPicker live={live} sectionId={sectionId} fmt={fmt} />
      </CardHeader>
      <CardContent className="space-y-3">
        {next ? (
          <>
            <p className="text-sm font-medium">What {next.label} needs</p>
            {rows.map((r) => (
              <div key={r.label} className="space-y-1">
                <div className="flex justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className={cn("tabular-nums", r.short ? "text-foreground" : "text-emerald-600")}>
                    {r.have} / {r.need}
                  </span>
                </div>
                <Progress value={r.value} aria-label={`${r.label} towards ${next.label}`} />
              </div>
            ))}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {fmt.money(amount)} across {pluralize(chapters, "chapter")} and {pluralize(members, "member")} — the top category.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MyTier({ live, fmt }: { live: HandbookLive; fmt: LiveFormat }) {
  if (!live.me) return null;
  const { tier, amount, rankTier, thisYear } = live.me;
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          aria-hidden
          className="flex h-20 w-32 shrink-0 items-end rounded-lg p-2 text-xs font-semibold text-white shadow-sm"
          style={{ background: `linear-gradient(135deg, ${tier.color}, color-mix(in oklab, ${tier.color} 55%, black))` }}
        >
          {tier.label}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">Your membership card</p>
          <p className="text-lg font-semibold leading-snug">{tier.label}</p>
          <p className="text-sm text-muted-foreground">
            {rankTier ? `Among the top partners in the zone for consecutive years.` : `Based on your ${yearNote(live)} giving of ${fmt.money(amount)}.`}
          </p>
          {live.year !== live.currentYear && (
            <p className="text-sm">
              This year so far: <span className="font-medium">{fmt.money(thisYear.amount)}</span>
              {thisYear.gap && (
                <>
                  {" "}
                  — {fmt.money(thisYear.gap.amount)} more by 31 December reaches {thisYear.gap.next.label}.
                </>
              )}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TierDistribution({ live, sectionId, fmt }: { live: HandbookLive; sectionId: string; fmt: LiveFormat }) {
  if (!live.distribution) return null;
  const total = live.distribution.reduce((s, d) => s + d.count, 0);
  const max = Math.max(1, ...live.distribution.map((d) => d.count));
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>Members by card colour</CardTitle>
          <CardDescription>
            {pluralize(total, "member")} in your scope · {yearNote(live)}
          </CardDescription>
        </div>
        <YearPicker live={live} sectionId={sectionId} fmt={fmt} />
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {live.distribution.map(({ tier, count }) => (
            <li key={tier.code} className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
              <span className="truncate">{tier.label}</span>
              <span className="h-3 rounded-full bg-muted">
                <span
                  className="block h-3 rounded-full"
                  style={{ width: `${(count / max) * 100}%`, backgroundColor: tier.color, minWidth: count > 0 ? "0.5rem" : 0 }}
                />
              </span>
              <span className="text-right tabular-nums text-muted-foreground">{count}</span>
            </li>
          ))}
        </ul>
        {!live.rankTierComputed && live.distribution[0] && live.distribution[0].tier.minAmount === Infinity && (
          <p className="mt-3 text-xs text-muted-foreground">
            {live.distribution[0].tier.label} compares every member in the zone, so it&apos;s only worked out for zone-wide leaders.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

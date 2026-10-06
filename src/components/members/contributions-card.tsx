import { CalendarCheck2, CalendarX2, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORICAL } from "@/lib/chart-colors";
import { convertFromUsd, type CurrencyCode } from "@/lib/currency";
import { CATEGORY_LABELS, CATEGORY_ORDER, shortMonth, type CategoryKey, type ContributionSummary } from "@/lib/giving-summary";
import type { MemberStanding } from "@/lib/handbook/member-standing";
import { cn, pluralize } from "@/lib/utils";

const COLOR: Record<CategoryKey, string> = Object.fromEntries(
  CATEGORY_ORDER.map((k, i) => [k, k === "uncategorised" ? "var(--muted-foreground)" : CATEGORICAL[i % CATEGORICAL.length]])
) as Record<CategoryKey, string>;

// A member's contributions: lifetime split by giving type, year by year,
// their card colour, and whether dues are up to date. Shown to the member
// themselves and to leaders who may see individual giving.
export function ContributionsCard({
  summary,
  standing,
  currency,
  rates,
  self,
}: {
  summary: ContributionSummary;
  standing: MemberStanding | null;
  currency: CurrencyCode;
  rates: Record<string, number>;
  // Wording: "you" on the member's own page, "they" for a leader.
  self: boolean;
}) {
  // Whole amounts throughout, so columns line up.
  const format = new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 });
  const money = (usd: number) => format.format(Math.round(convertFromUsd(usd, currency, rates)));
  const shown = CATEGORY_ORDER.filter((k) => summary.byCategory[k] > 0);
  const { dues } = summary;
  const usesDues = summary.byCategory.dues > 0;
  const noMonthsDueYet = dues.dueMonths.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{self ? "Your contributions" : "Contributions"}</CardTitle>
        <CardDescription>
          {summary.total > 0
            ? `${money(summary.total)} in total${summary.years.length > 1 ? ` over ${pluralize(summary.years.length, "year")}` : ""}`
            : "No giving recorded yet."}
        </CardDescription>
      </CardHeader>
      {summary.total > 0 && (
        <CardContent className="space-y-6">
          {/* By giving type */}
          <div className="space-y-3">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Share of giving by type">
              {shown.map((k) => (
                <span key={k} style={{ width: `${(summary.byCategory[k] / summary.total) * 100}%`, backgroundColor: COLOR[k] }} />
              ))}
            </div>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {shown.map((k) => (
                <li key={k} className="rounded-lg border p-3">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR[k] }} />
                    {CATEGORY_LABELS[k]}
                  </p>
                  <p className="text-lg font-semibold tabular-nums">{money(summary.byCategory[k])}</p>
                  <p className="text-xs text-muted-foreground">{Math.round((summary.byCategory[k] / summary.total) * 100)}% of total</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* Year by year */}
            <div className="lg:col-span-3">
              <p className="mb-2 text-sm font-medium">Year by year</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Year</th>
                      {shown.map((k) => (
                        <th key={k} className="hidden px-3 py-2 text-right font-medium sm:table-cell">
                          {CATEGORY_LABELS[k]}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-medium">Total</th>
                      <th className="px-3 py-2 text-right font-medium" title="This year is compared with the same months of last year">
                        vs year before
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.years.map((y) => (
                      <tr key={y.year}>
                        <td className="px-3 py-2 font-medium tabular-nums">
                          {y.year}
                          {y.year === dues.year && <span className="ml-1 text-xs font-normal text-muted-foreground">so far</span>}
                        </td>
                        {shown.map((k) => (
                          <td key={k} className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                            {y.byCategory[k] > 0 ? money(y.byCategory[k]) : "—"}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(y.total)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">
                          {y.change === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={cn("inline-flex items-center gap-0.5", y.change >= 0 ? "text-emerald-600" : "text-red-600")}>
                              {y.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {y.change >= 0 ? "+" : ""}
                              {Math.round(y.change * 100)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4 lg:col-span-2">
              {/* Card colour */}
              {standing && (
                <div className="flex items-start gap-3 rounded-lg border p-3">
                  <span
                    aria-hidden
                    className="mt-0.5 h-10 w-14 shrink-0 rounded-md shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${standing.tier.color}, color-mix(in oklab, ${standing.tier.color} 55%, black))` }}
                  />
                  <div className="min-w-0 space-y-0.5 text-sm">
                    <p className="font-medium">{standing.tier.label} card</p>
                    <p className="text-xs text-muted-foreground">
                      From {money(standing.basisAmount)} given in {standing.basisYear}.
                    </p>
                    <p className="text-xs">
                      {standing.thisYear.year} so far: {money(standing.thisYear.amount)}
                      {standing.thisYear.gap
                        ? ` — ${money(standing.thisYear.gap.amount)} more reaches ${standing.thisYear.gap.next.label}.`
                        : " — top card."}
                    </p>
                  </div>
                </div>
              )}

              {/* Dues */}
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="flex items-center gap-1.5 font-medium">
                  {dues.missedMonths.length === 0 ? (
                    <CalendarCheck2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <CalendarX2 className="h-4 w-4 text-amber-600" />
                  )}
                  Dues {dues.year}
                </p>
                {!usesDues ? (
                  <p className="text-xs text-muted-foreground">No dues recorded yet.</p>
                ) : noMonthsDueYet ? (
                  <p className="text-xs text-muted-foreground">
                    {dues.currentMonthPaid ? `${shortMonth(dues.currentMonth)} is paid.` : `${shortMonth(dues.currentMonth)} isn't recorded yet.`}
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {dues.dueMonths.length - dues.missedMonths.length} of {pluralize(dues.dueMonths.length, "month")} paid so far
                      {dues.currentMonthPaid ? `, plus ${shortMonth(dues.currentMonth)}` : ""}.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {dues.dueMonths.map((m) => {
                        const missed = dues.missedMonths.includes(m);
                        return (
                          <span
                            key={m}
                            title={missed ? "Not recorded" : "Paid"}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[11px] tabular-nums",
                              missed ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            )}
                          >
                            {shortMonth(m)}
                          </span>
                        );
                      })}
                    </div>
                    {dues.missedMonths.length > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        {self ? "You have" : "They have"} {pluralize(dues.missedMonths.length, "month")} without dues recorded.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

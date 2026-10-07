import Link from "next/link";
import { Users, Church, Network, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRecentActivity, getZoneStats } from "@/lib/data/analytics";
import type { Dataset } from "@/lib/data/analytics";
import type { Cell } from "@/lib/data/types";
import { labels, lower } from "@/lib/labels";
import { pluralize } from "@/lib/utils";
import { tenant } from "@/tenant";

// The dashboard for a deployment that doesn't track giving: membership,
// structure and age groups — the figures it does have. (Attendance figures
// join here once that module is built.)
export function OverviewDashboard({ ds, cells, scopeName }: { ds: Dataset; cells: Cell[]; scopeName: string }) {
  const stats = getZoneStats(ds);
  const activity = getRecentActivity(ds, 7);
  const locations = ds.churches.filter((c) => !c.isOffice);

  const ageGroups = (tenant.ageGroups ?? []).map((g) => ({
    label: g.label,
    range: g.maxAge === undefined ? `${g.minAge ?? 0}+` : `${g.minAge ?? 0}–${g.maxAge}`,
    count: ds.members.filter((m) => m.ageGroup === g.key).length,
  }));
  const ungrouped = ds.members.filter((m) => !tenant.ageGroups?.some((g) => g.key === m.ageGroup)).length;

  const cellSizes = cells
    .map((c) => ({ cell: c, count: ds.members.filter((m) => m.cellId === c.id).length }))
    .sort((a, b) => b.count - a.count);
  const withoutCell = ds.members.filter((m) => !m.cellId).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Membership across {scopeName}.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Members" value={stats.totalMembers.toLocaleString()} icon={Users} />
        <StatCard label={labels.locations} value={String(locations.length)} icon={Church} />
        <StatCard label={labels.cells} value={String(cells.length)} icon={Network} />
        <StatCard label="New this month" value={String(stats.newThisMonth)} icon={TrendingUp} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {ageGroups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Age groups</CardTitle>
              <CardDescription>
                {ungrouped > 0 ? `${pluralize(ungrouped, "member")} not yet in an age group` : "Every member is in an age group"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ageGroups.map((g) => (
                <CountBar key={g.label} label={g.label} hint={g.range} count={g.count} total={stats.totalMembers} />
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{labels.locations}</CardTitle>
            <CardDescription>Members and {lower(labels.cells)} in each {lower(labels.location)}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {locations.length === 0 && <p className="text-sm text-muted-foreground">No {lower(labels.locations)} yet.</p>}
            {locations.map((loc) => (
              <Link
                key={loc.id}
                href={`/churches/${loc.id}`}
                className="flex items-center justify-between py-2.5 text-sm hover:text-primary transition-colors"
              >
                <span className="font-medium">{loc.name}</span>
                <span className="text-muted-foreground">
                  {pluralize(ds.members.filter((m) => m.churchId === loc.id).length, "member")} ·{" "}
                  {pluralize(cells.filter((c) => c.churchId === loc.id).length, lower(labels.cell), lower(labels.cells))}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Largest {lower(labels.cells)}</CardTitle>
            <CardDescription>
              {withoutCell > 0 ? `${pluralize(withoutCell, "member")} not in a ${lower(labels.cell)}` : `Every member is in a ${lower(labels.cell)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {cellSizes.length === 0 && <p className="text-sm text-muted-foreground">No {lower(labels.cells)} yet.</p>}
            {cellSizes.slice(0, 8).map(({ cell, count }) => (
              <CountBar key={cell.id} label={cell.name} count={count} total={cellSizes[0]?.count || 1} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>The latest changes across {scopeName}</CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={activity} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CountBar({ label, hint, count, total }: { label: string; hint?: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">
          {label}
          {hint && <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span>}
        </span>
        <span className="tabular-nums text-muted-foreground">{count.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

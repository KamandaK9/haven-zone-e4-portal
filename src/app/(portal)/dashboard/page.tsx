import { redirect } from "next/navigation";
import { Users, Church, Globe2, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { CountryGrid } from "@/components/dashboard/country-grid";
import { TopGivers } from "@/components/dashboard/top-givers";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ChurchHealthList } from "@/components/dashboard/church-health";
import { GivingCategorySelect } from "@/components/dashboard/giving-category-select";
import { GivingTrendChart } from "@/components/charts/giving-trend-chart";
import { BarBreakdownChart } from "@/components/charts/bar-breakdown-chart";
import { TenureChart } from "@/components/charts/tenure-chart";
import { GrowthChart } from "@/components/charts/growth-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getDisplayCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/currency";
import { givingFilterLabel, parseGivingFilter } from "@/lib/giving";
import {
  getChurchHealth,
  getGivingByChurch,
  getGivingByCountry,
  getGivingTrendZone,
  getMembershipGrowth,
  getRecentActivity,
  getTenureDistribution,
  getTopGivers,
  getUpcomingEvents,
  getZoneStats,
} from "@/lib/data/analytics";
import { Download, CalendarClock } from "lucide-react";
import { describeScope } from "@/lib/scope-label";
import Link from "next/link";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const giving = parseGivingFilter((await searchParams).giving);
  const givingLabel = giving === "all" ? "Total giving" : givingFilterLabel(giving);
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const ds = await getZoneDataset(profile.zoneId);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);
  const scopeName = describeScope(profile, ds);
  const stats = getZoneStats(ds);
  const givingTrend = getGivingTrendZone(ds, giving);
  const givingTrendTotal = givingTrend.reduce((sum, p) => sum + p.amount, 0);
  const givingByCountry = getGivingByCountry(ds, giving);
  const givingByChurch = getGivingByChurch(ds, undefined, giving).slice(0, 8);
  const tenure = getTenureDistribution(ds.members);
  const growth = getMembershipGrowth(ds);
  const health = getChurchHealth(ds);
  const topGivers = getTopGivers(ds, 6, giving);
  const activity = getRecentActivity(ds, 7);
  const events = getUpcomingEvents(ds, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.scope === "zone" ? "Zone Dashboard" : "Dashboard"}</h1>
          <p className="text-sm text-muted-foreground">
            An overview of membership, giving, and growth across {scopeName}.
          </p>
        </div>
        {can(profile, "view_reports") && (
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/reports">
              <Download className="h-3.5 w-3.5" />
              Full report
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total members" value={stats.totalMembers.toLocaleString()} icon={Users} delta={stats.growthPct} deltaLabel="vs last quarter" />
        <StatCard label="Total Chapters" value={String(stats.totalChurches)} icon={Church} />
        <StatCard label="Countries" value={String(stats.totalCountries)} icon={Globe2} />
        <StatCard label="New this month" value={String(stats.newThisMonth)} icon={TrendingUp} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className={ds.individualGiving ? "lg:col-span-2" : "lg:col-span-3"}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              <CardTitle>
                <GivingCategorySelect value={giving} />
              </CardTitle>
              <CardDescription>{scopeName}, last 12 months</CardDescription>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold tracking-tight tabular-nums">
                {formatMoney(givingTrendTotal, currency, rates)}
              </p>
              <p className="text-xs text-muted-foreground">{givingLabel}</p>
            </div>
          </CardHeader>
          <CardContent>
            <GivingTrendChart data={givingTrend} currency={currency} rates={rates} />
          </CardContent>
        </Card>

        {ds.individualGiving && (
          <Card>
            <CardHeader>
              <CardTitle>Top givers</CardTitle>
              <CardDescription>Leaderboard · {givingFilterLabel(giving)}</CardDescription>
            </CardHeader>
            <CardContent>
              <TopGivers givers={topGivers} ds={ds} currency={currency} rates={rates} />
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Countries in {ds.zoneName}</CardTitle>
          <CardDescription>Click a country to drill into its chapters</CardDescription>
        </CardHeader>
        <CardContent>
          <CountryGrid countries={ds.countries} ds={ds} />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Giving by country</CardTitle>
            <CardDescription>{givingFilterLabel(giving)}, 12-month sum</CardDescription>
          </CardHeader>
          <CardContent>
            <BarBreakdownChart
              data={givingByCountry}
              nameKey="name"
              dataKey="amount"
              layout="vertical"
              currency={currency}
              rates={rates}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Giving by chapter</CardTitle>
            <CardDescription>Top 8 chapters · {givingFilterLabel(giving)}, 12-month sum</CardDescription>
          </CardHeader>
          <CardContent>
            <BarBreakdownChart
              data={givingByChurch}
              nameKey="name"
              dataKey="amount"
              layout="vertical"
              currency={currency}
              rates={rates}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Time in The Haven</CardTitle>
            <CardDescription>Membership tenure distribution, zone-wide</CardDescription>
          </CardHeader>
          <CardContent>
            <TenureChart data={tenure} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Membership growth</CardTitle>
            <CardDescription>New vs. cumulative members over 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <GrowthChart data={growth} />
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Zone health summary</CardTitle>
            <CardDescription>Which chapters are growing, flat, or need attention</CardDescription>
          </CardHeader>
          <CardContent>
            <ChurchHealthList rows={health} ds={ds} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
                  No activity yet.
                </p>
              ) : (
                <ActivityFeed items={activity} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Upcoming events</CardTitle>
              <Link href="/calendar" className="text-xs font-medium text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No upcoming events.</p>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="flex items-start gap-2.5 text-sm">
                    <CalendarClock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium leading-snug">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} &middot; {e.time}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

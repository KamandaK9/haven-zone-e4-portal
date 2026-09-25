import { redirect } from "next/navigation";
import { Users, Church, Globe2, HandCoins } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { TopGivers } from "@/components/dashboard/top-givers";
import { ChurchHealthList } from "@/components/dashboard/church-health";
import { GivingCategorySelect } from "@/components/dashboard/giving-category-select";
import { GivingTrendChart } from "@/components/charts/giving-trend-chart";
import { BarBreakdownChart } from "@/components/charts/bar-breakdown-chart";
import { TenureChart } from "@/components/charts/tenure-chart";
import { GrowthChart } from "@/components/charts/growth-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  getTotalGiving,
  getTenureDistribution,
  getTopGivers,
  getZoneStats,
} from "@/lib/data/analytics";
import { tenant } from "@/tenant";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const giving = parseGivingFilter((await searchParams).giving);
  const givingLabel = givingFilterLabel(giving);
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "view_reports")) redirect("/dashboard");
  const ds = await getZoneDataset(profile.zoneId);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);

  const stats = getZoneStats(ds);
  const givingTrend = getGivingTrendZone(ds, giving);
  const givingByCountry = getGivingByCountry(ds, giving);
  const givingByChurch = getGivingByChurch(ds, undefined, giving);
  const tenure = getTenureDistribution(ds.members);
  const growth = getMembershipGrowth(ds);
  const health = getChurchHealth(ds);
  const topGivers = getTopGivers(ds, 15, giving);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Giving, membership, and church-health reporting for {ds.zoneName}.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total members" value={stats.totalMembers.toLocaleString()} icon={Users} />
        <StatCard label="Total Chapters" value={String(stats.totalChurches)} icon={Church} />
        <StatCard label="Countries" value={String(stats.totalCountries)} icon={Globe2} />
        <StatCard
          label={giving === "all" ? "Total giving" : `${givingLabel} giving`}
          value={formatMoney(getTotalGiving(ds, giving), currency, rates)}
          icon={HandCoins}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <GivingCategorySelect value={giving} />
            </CardTitle>
            <CardDescription>Zone-wide, last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <GivingTrendChart data={givingTrend} currency={currency} rates={rates} />
          </CardContent>
        </Card>
        {ds.individualGiving && (
          <Card>
            <CardHeader>
              <CardTitle>Top givers</CardTitle>
              <CardDescription>Zone-wide leaderboard · {givingLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <TopGivers givers={topGivers} ds={ds} currency={currency} rates={rates} />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Giving by country</CardTitle>
            <CardDescription>{givingLabel}, 12-month sum</CardDescription>
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
            <CardDescription>All chapters · {givingLabel}, 12-month sum</CardDescription>
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
            <CardTitle>Time in {tenant.name}</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>Zone health summary</CardTitle>
          <CardDescription>Which chapters are growing, flat, or need attention</CardDescription>
        </CardHeader>
        <CardContent>
          <ChurchHealthList rows={health} ds={ds} />
        </CardContent>
      </Card>
    </div>
  );
}

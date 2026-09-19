import { redirect } from "next/navigation";
import { Users, Church, Globe2, HandCoins } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { TopGivers } from "@/components/dashboard/top-givers";
import { ChurchHealthList } from "@/components/dashboard/church-health";
import { GivingTrendChart } from "@/components/charts/giving-trend-chart";
import { BarBreakdownChart } from "@/components/charts/bar-breakdown-chart";
import { TenureChart } from "@/components/charts/tenure-chart";
import { GrowthChart } from "@/components/charts/growth-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getDisplayCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/currency";
import {
  getChurchHealth,
  getGivingByChurch,
  getGivingByCountry,
  getGivingTrendZone,
  getMembershipGrowth,
  getTenureDistribution,
  getTopGivers,
  getZoneStats,
} from "@/lib/data/analytics";

export default async function ReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (profile.role !== "super_admin") redirect("/dashboard");
  const ds = await getZoneDataset(profile.zoneId);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);

  const stats = getZoneStats(ds);
  const givingTrend = getGivingTrendZone(ds);
  const givingByCountry = getGivingByCountry(ds);
  const givingByChurch = getGivingByChurch(ds);
  const tenure = getTenureDistribution(ds.members);
  const growth = getMembershipGrowth(ds);
  const health = getChurchHealth(ds);
  const topGivers = getTopGivers(ds, 15);

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
        <StatCard label="Total churches" value={String(stats.totalChurches)} icon={Church} />
        <StatCard label="Countries" value={String(stats.totalCountries)} icon={Globe2} />
        <StatCard label="Total giving" value={formatMoney(stats.totalGiving, currency, rates)} icon={HandCoins} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tithe &amp; giving trend</CardTitle>
            <CardDescription>Zone-wide giving over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <GivingTrendChart data={givingTrend} currency={currency} rates={rates} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top givers</CardTitle>
            <CardDescription>Zone-wide leaderboard</CardDescription>
          </CardHeader>
          <CardContent>
            <TopGivers givers={topGivers} ds={ds} currency={currency} rates={rates} />
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Giving by country</CardTitle>
            <CardDescription>Total tithe &amp; giving, 12-month sum</CardDescription>
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
            <CardTitle>Giving by church</CardTitle>
            <CardDescription>All churches, 12-month sum</CardDescription>
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
            <CardTitle>Time in Haven</CardTitle>
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
          <CardDescription>Which churches are growing, flat, or need attention</CardDescription>
        </CardHeader>
        <CardContent>
          <ChurchHealthList rows={health} ds={ds} />
        </CardContent>
      </Card>
    </div>
  );
}

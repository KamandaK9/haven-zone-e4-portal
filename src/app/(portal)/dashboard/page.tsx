"use client";

import { Users, Church, Globe2, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { CountryGrid } from "@/components/dashboard/country-grid";
import { TopGivers } from "@/components/dashboard/top-givers";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ChurchHealthList } from "@/components/dashboard/church-health";
import { GivingTrendChart } from "@/components/charts/giving-trend-chart";
import { BarBreakdownChart } from "@/components/charts/bar-breakdown-chart";
import { TenureChart } from "@/components/charts/tenure-chart";
import { GrowthChart } from "@/components/charts/growth-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useZone } from "@/lib/data/zone-context";
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
import Link from "next/link";

export default function DashboardPage() {
  const { data: ds } = useZone();
  const stats = getZoneStats(ds);
  const givingTrend = getGivingTrendZone(ds);
  const givingByCountry = getGivingByCountry(ds);
  const givingByChurch = getGivingByChurch(ds).slice(0, 8);
  const tenure = getTenureDistribution(ds.members);
  const growth = getMembershipGrowth(ds);
  const health = getChurchHealth(ds);
  const topGivers = getTopGivers(ds, 6);
  const activity = getRecentActivity(ds, 7);
  const events = getUpcomingEvents(ds, 4);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Zone Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            An overview of membership, giving, and growth across {ds.zoneName}.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-3.5 w-3.5" />
          Export report
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total members" value={stats.totalMembers.toLocaleString()} icon={Users} delta={stats.growthPct} deltaLabel="vs last quarter" />
        <StatCard label="Total churches" value={String(stats.totalChurches)} icon={Church} />
        <StatCard label="Countries" value={String(stats.totalCountries)} icon={Globe2} />
        <StatCard label="New this month" value={String(stats.newThisMonth)} icon={TrendingUp} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tithe &amp; giving trend</CardTitle>
            <CardDescription>Zone-wide giving over the last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <GivingTrendChart data={givingTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top givers</CardTitle>
            <CardDescription>Zone-wide leaderboard</CardDescription>
          </CardHeader>
          <CardContent>
            <TopGivers givers={topGivers} ds={ds} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Countries in {ds.zoneName}</CardTitle>
          <CardDescription>Click a country to drill into its churches</CardDescription>
        </CardHeader>
        <CardContent>
          <CountryGrid countries={ds.countries} ds={ds} />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Giving by country</CardTitle>
            <CardDescription>Total tithe &amp; giving, 12-month sum</CardDescription>
          </CardHeader>
          <CardContent>
            <BarBreakdownChart data={givingByCountry} nameKey="name" dataKey="amount" layout="vertical" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Giving by church</CardTitle>
            <CardDescription>Top 8 churches, 12-month sum</CardDescription>
          </CardHeader>
          <CardContent>
            <BarBreakdownChart data={givingByChurch} nameKey="name" dataKey="amount" layout="vertical" />
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

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Zone health summary</CardTitle>
            <CardDescription>Which churches are growing, flat, or need attention</CardDescription>
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

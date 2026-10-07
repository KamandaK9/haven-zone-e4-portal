import { redirect } from "next/navigation";
import { labels, lower } from "@/lib/labels";
import { AttendanceReport } from "@/components/reports/attendance-report";
import { getZoneCells } from "@/lib/data/cells";
import { churchToday, getAttendanceData } from "@/lib/data/attendance";
import { summarise } from "@/lib/attendance/summary";
import { getCourse, getVisibleClassAttendance } from "@/lib/data/courses";
import { courseProgress } from "@/lib/courses/progress";
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
import { getModules } from "@/lib/modules-server";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const giving = parseGivingFilter((await searchParams).giving);
  const givingLabel = givingFilterLabel(giving);
  const profile = await getCurrentProfile();
  const modules = await getModules();
  if (!profile) redirect("/");
  if (!can(profile, "view_reports")) redirect("/dashboard");
  // Without giving, reports are attendance reports.
  if (!modules.giving) {
    if (!modules.attendance) redirect("/dashboard");
    const [ds, cells, data] = await Promise.all([getZoneDataset(profile.zoneId), getZoneCells(profile.zoneId), getAttendanceData()]);
    const members = ds.members.filter((m) => !m.isVisitor && (profile.scope !== "cell" || m.cellId === profile.cellId));
    const standing = summarise(members, data.services, data.attendance, churchToday());
    let course: { name: string; completed: number; inProgress: number } | undefined;
    const c = modules.courses ? await getCourse(profile.zoneId) : undefined;
    if (c) {
      const byMember = new Map<string, string[]>();
      for (const a of await getVisibleClassAttendance()) byMember.set(a.memberId, [...(byMember.get(a.memberId) ?? []), a.classId]);
      const ids = c.classes.map((x) => x.id);
      const done = [...byMember.values()].filter((v) => courseProgress(v, ids, c.requiredClasses).completed).length;
      course = { name: c.name, completed: done, inProgress: byMember.size - done };
    }
    return (
      <AttendanceReport
        ds={ds}
        cells={cells}
        services={data.services}
        attendance={data.attendance}
        standing={standing}
        course={course}
        canExport={can(profile, "export_data")}
      />
    );
  }
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
        <StatCard label={`Total ${labels.locations}`} value={String(stats.totalChurches)} icon={Church} />
        <StatCard label={labels.countries} value={String(stats.totalCountries)} icon={Globe2} />
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
            <CardDescription>{labels.zone}-wide, last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <GivingTrendChart data={givingTrend} currency={currency} rates={rates} />
          </CardContent>
        </Card>
        {ds.individualGiving && (
          <Card>
            <CardHeader>
              <CardTitle>Top givers</CardTitle>
              <CardDescription>{labels.zone}-wide leaderboard · {givingLabel}</CardDescription>
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
            <CardTitle>Giving by {lower(labels.location)}</CardTitle>
            <CardDescription>All {lower(labels.locations)} · {givingLabel}, 12-month sum</CardDescription>
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
            <CardDescription>Membership tenure distribution, {lower(labels.zone)}-wide</CardDescription>
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
          <CardTitle>{labels.zone} health summary</CardTitle>
          <CardDescription>Which {lower(labels.locations)} are growing, flat, or need attention</CardDescription>
        </CardHeader>
        <CardContent>
          <ChurchHealthList rows={health} ds={ds} />
        </CardContent>
      </Card>
    </div>
  );
}

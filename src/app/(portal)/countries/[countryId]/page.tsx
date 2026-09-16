import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Church as ChurchIcon, Users, HandCoins, Clock } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarBreakdownChart } from "@/components/charts/bar-breakdown-chart";
import {
  getChurchesByCountry,
  getChurchStats,
  getCountry,
  getCountryStats,
  getGivingByChurch,
} from "@/lib/data/analytics";

export default async function CountryPage({
  params,
}: {
  params: Promise<{ countryId: string }>;
}) {
  const { countryId } = await params;
  const country = getCountry(countryId);
  if (!country) notFound();

  const stats = getCountryStats(countryId);
  const churches = getChurchesByCountry(countryId);
  const giving = getGivingByChurch(countryId);

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Zone Dashboard", href: "/dashboard" },
          { label: "Countries", href: "/countries" },
          { label: country.name },
        ]}
      />

      <div className="flex items-center gap-3">
        <span className="text-4xl leading-none">{country.flag}</span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{country.name}</h1>
          <p className="text-sm text-muted-foreground">
            {stats.churchCount} churches &middot; {stats.memberCount} members
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Members" value={stats.memberCount.toLocaleString()} icon={Users} />
        <StatCard label="Churches" value={String(stats.churchCount)} icon={ChurchIcon} />
        <StatCard label="Total giving" value={`$${stats.totalGiving.toLocaleString()}`} icon={HandCoins} />
        <StatCard label="Avg. tenure" value={`${stats.avgTenure.toFixed(1)} yrs`} icon={Clock} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Churches in {country.name}</CardTitle>
          <CardDescription>Click a church to view its members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {churches.map((church) => {
            const cStats = getChurchStats(church.id);
            return (
              <Link
                key={church.id}
                href={`/churches/${church.id}`}
                className="flex items-center justify-between rounded-xl border p-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div>
                  <p className="font-medium text-sm">{church.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {church.city} &middot; {church.pastor} &middot; est. {church.foundedYear}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">{cStats.memberCount}</p>
                    <p className="text-[11px] text-muted-foreground">members</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">${cStats.totalGiving.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">giving</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Giving by church</CardTitle>
          <CardDescription>12-month total, {country.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <BarBreakdownChart data={giving} nameKey="name" dataKey="amount" layout="vertical" />
        </CardContent>
      </Card>
    </div>
  );
}

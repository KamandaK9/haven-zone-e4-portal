"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Church as ChurchIcon, Users, HandCoins, Clock } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarBreakdownChart } from "@/components/charts/bar-breakdown-chart";
import { useZone } from "@/lib/data/zone-context";
import {
  getChurchesByCountry,
  getChurchStats,
  getCountry,
  getCountryStats,
  getGivingByChurch,
} from "@/lib/data/analytics";
import { pluralize } from "@/lib/utils";

export default function CountryPage() {
  const { countryId } = useParams<{ countryId: string }>();
  const { data: ds } = useZone();
  const country = getCountry(ds, countryId);

  if (!country) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Zone Dashboard", href: "/dashboard" }, { label: "Countries", href: "/countries" }, { label: "Not found" }]} />
        <p className="text-sm text-muted-foreground">This country doesn&apos;t exist.</p>
        <Link href="/countries" className="text-sm text-primary hover:underline">
          Back to countries
        </Link>
      </div>
    );
  }

  const stats = getCountryStats(ds, countryId);
  const churches = getChurchesByCountry(ds, countryId);
  const giving = getGivingByChurch(ds, countryId);

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
            {pluralize(stats.churchCount, "church", "churches")} &middot; {pluralize(stats.memberCount, "member")}
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
          {churches.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
              No churches yet. Add some from Zone Setup.
            </p>
          )}
          {churches.map((church) => {
            const cStats = getChurchStats(ds, church.id);
            const subline = [church.city, church.pastor, church.foundedYear ? `est. ${church.foundedYear}` : null]
              .filter(Boolean)
              .join(" · ");
            return (
              <Link
                key={church.id}
                href={`/churches/${church.id}`}
                className="flex items-center justify-between rounded-xl border p-4 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div>
                  <p className="font-medium text-sm">{church.name}</p>
                  {subline && <p className="text-xs text-muted-foreground mt-0.5">{subline}</p>}
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

      {giving.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Giving by church</CardTitle>
            <CardDescription>12-month total, {country.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarBreakdownChart data={giving} nameKey="name" dataKey="amount" layout="vertical" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

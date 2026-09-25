import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Church as ChurchIcon, Users, HandCoins, Clock } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarBreakdownChart } from "@/components/charts/bar-breakdown-chart";
import { GivingCategorySelect } from "@/components/dashboard/giving-category-select";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { RenameChapterDialog } from "@/components/dashboard/rename-chapter-dialog";
import { getDisplayCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/currency";
import {
  getChurchesByCountry,
  getChurchStats,
  getCountry,
  getCountryStats,
  getGivingByChurch,
} from "@/lib/data/analytics";
import { pluralize } from "@/lib/utils";
import { givingFilterLabel, parseGivingFilter } from "@/lib/giving";

export default async function CountryPage({
  params,
  searchParams,
}: {
  params: Promise<{ countryId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { countryId } = await params;
  const givingFilter = parseGivingFilter((await searchParams).giving);
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const ds = await getZoneDataset(profile.zoneId);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);
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
  const giving = getGivingByChurch(ds, countryId, givingFilter);
  const givingByChurchId = new Map(giving.map((g) => [g.churchId, g.amount]));
  const totalGiving = giving.reduce((sum, g) => sum + g.amount, 0);
  const canRename = can(profile, "manage_members");

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
            {pluralize(stats.churchCount, "chapter")} &middot; {pluralize(stats.memberCount, "member")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Members" value={stats.memberCount.toLocaleString()} icon={Users} />
        <StatCard label="Chapters" value={String(stats.churchCount)} icon={ChurchIcon} />
        <StatCard
          label={givingFilter === "all" ? "Total giving" : `${givingFilterLabel(givingFilter)} giving`}
          value={formatMoney(totalGiving, currency, rates)}
          icon={HandCoins}
        />
        <StatCard label="Avg. tenure" value={stats.avgTenure > 0 ? `${stats.avgTenure.toFixed(1)} yrs` : "—"} icon={Clock} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chapters in {country.name}</CardTitle>
          <CardDescription>Click a chapter to view its members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {churches.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
              No chapters yet. Add some from Zone Setup.
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
                <div className="flex items-center gap-1 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{church.name}</p>
                    {subline && <p className="text-xs text-muted-foreground mt-0.5">{subline}</p>}
                  </div>
                  {canRename && <RenameChapterDialog churchId={church.id} currentName={church.name} />}
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">{cStats.memberCount}</p>
                    <p className="text-[11px] text-muted-foreground">members</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">
                      {formatMoney(givingByChurchId.get(church.id) ?? 0, currency, rates)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {givingFilter === "all" ? "giving" : givingFilterLabel(givingFilter)}
                    </p>
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
            <CardTitle>
              <GivingCategorySelect value={givingFilter} />
            </CardTitle>
            <CardDescription>By chapter, {country.name}</CardDescription>
          </CardHeader>
          <CardContent>
            <BarBreakdownChart
              data={giving}
              nameKey="name"
              dataKey="amount"
              layout="vertical"
              currency={currency}
              rates={rates}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

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
import { labels, lower } from "@/lib/labels";
import { getZoneCells } from "@/lib/data/cells";
import { AddLocationDialog } from "@/components/dashboard/add-location-dialog";
import { Network } from "lucide-react";
import { getModules } from "@/lib/modules-server";

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
  const modules = await getModules();
  if (!profile) redirect("/");
  const ds = await getZoneDataset(profile.zoneId);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);
  const country = getCountry(ds, countryId);

  if (!country) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: labels.countries, href: "/countries" }, { label: "Not found" }]} />
        <p className="text-sm text-muted-foreground">This {lower(labels.country)} doesn&apos;t exist.</p>
        <Link href="/countries" className="text-sm text-primary hover:underline">
          Back to {lower(labels.countries)}
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
  const showGiving = modules.giving;
  // One country: this page *is* the list of locations, so it's titled that way.
  const single = ds.countries.length === 1;
  const churchIds = new Set(churches.map((c) => c.id));
  const cells = showGiving ? [] : (await getZoneCells(profile.zoneId)).filter((c) => churchIds.has(c.churchId));

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={
          single
            ? [{ label: "Dashboard", href: "/dashboard" }, { label: labels.locations }]
            : [{ label: "Dashboard", href: "/dashboard" }, { label: labels.countries, href: "/countries" }, { label: country.name }]
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-4xl leading-none">{country.flag}</span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{single ? labels.locations : country.name}</h1>
            <p className="text-sm text-muted-foreground">
              {single && `${country.name} · `}
              {pluralize(stats.churchCount, lower(labels.location), lower(labels.locations))} &middot;{" "}
              {pluralize(stats.memberCount, "member")}
            </p>
          </div>
        </div>
        {profile.role === "super_admin" && <AddLocationDialog countryId={country.id} />}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Members" value={stats.memberCount.toLocaleString()} icon={Users} />
        <StatCard label={labels.locations} value={String(stats.churchCount)} icon={ChurchIcon} />
        {showGiving ? (
          <StatCard
            label={givingFilter === "all" ? "Total giving" : `${givingFilterLabel(givingFilter)} giving`}
            value={formatMoney(totalGiving, currency, rates)}
            icon={HandCoins}
          />
        ) : (
          <StatCard label={labels.cells} value={String(cells.length)} icon={Network} />
        )}
        <StatCard label="Avg. tenure" value={stats.avgTenure > 0 ? `${stats.avgTenure.toFixed(1)} yrs` : "—"} icon={Clock} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{single ? labels.locations : `${labels.locations} in ${country.name}`}</CardTitle>
          <CardDescription>Click a {lower(labels.location)} to view its members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {churches.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
              No {lower(labels.locations)} yet.
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
                  {showGiving ? (
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold">
                        {formatMoney(givingByChurchId.get(church.id) ?? 0, currency, rates)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {givingFilter === "all" ? "giving" : givingFilterLabel(givingFilter)}
                      </p>
                    </div>
                  ) : (
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold">{cells.filter((c) => c.churchId === church.id).length}</p>
                      <p className="text-[11px] text-muted-foreground">{lower(labels.cells)}</p>
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {showGiving && giving.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <GivingCategorySelect value={givingFilter} />
            </CardTitle>
            <CardDescription>By {lower(labels.location)}, {country.name}</CardDescription>
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

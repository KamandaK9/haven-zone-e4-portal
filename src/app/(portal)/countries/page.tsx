import { redirect } from "next/navigation";
import { CountryGrid } from "@/components/dashboard/country-grid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarBreakdownChart } from "@/components/charts/bar-breakdown-chart";
import { GivingTrendChart } from "@/components/charts/giving-trend-chart";
import { GivingCategorySelect } from "@/components/dashboard/giving-category-select";
import Link from "next/link";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getDisplayCurrency } from "@/lib/currency-server";
import { getGivingByCountry, getGivingTrendZone } from "@/lib/data/analytics";
import { givingFilterLabel, parseGivingFilter } from "@/lib/giving";
import { pluralize } from "@/lib/utils";

export default async function CountriesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const givingFilter = parseGivingFilter((await searchParams).giving);
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const ds = await getZoneDataset(profile.zoneId);
  if (ds.countries.length === 1) redirect(`/countries/${ds.countries[0].id}`);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);
  const giving = getGivingByCountry(ds, givingFilter);
  const trend = getGivingTrendZone(ds, givingFilter);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Countries</h1>
          <p className="text-sm text-muted-foreground">
            All {pluralize(ds.countries.length, "country", "countries")} covered by {ds.zoneName}.
          </p>
        </div>
        {can(profile, "manage_members") && (
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href="/members/duplicates">
              <Copy className="h-3.5 w-3.5" />
              Find duplicate members
            </Link>
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <CountryGrid countries={ds.countries} ds={ds} />
        </CardContent>
      </Card>

      {ds.countries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Giving, last 12 months</CardTitle>
            <CardDescription>{givingFilterLabel(givingFilter)}, month by month across all countries</CardDescription>
          </CardHeader>
          <CardContent>
            <GivingTrendChart data={trend} currency={currency} rates={rates} />
          </CardContent>
        </Card>
      )}

      {ds.countries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <GivingCategorySelect value={givingFilter} />
            </CardTitle>
            <CardDescription>{givingFilterLabel(givingFilter)} by country, 12-month sum</CardDescription>
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

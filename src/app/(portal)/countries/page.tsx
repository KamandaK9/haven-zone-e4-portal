"use client";

import { CountryGrid } from "@/components/dashboard/country-grid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarBreakdownChart } from "@/components/charts/bar-breakdown-chart";
import { useZone } from "@/lib/data/zone-context";
import { getGivingByCountry } from "@/lib/data/analytics";
import { pluralize } from "@/lib/utils";

export default function CountriesPage() {
  const { data: ds } = useZone();
  const giving = getGivingByCountry(ds);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Countries</h1>
        <p className="text-sm text-muted-foreground">
          All {pluralize(ds.countries.length, "country", "countries")} covered by {ds.zoneName}.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CountryGrid countries={ds.countries} ds={ds} />
        </CardContent>
      </Card>

      {ds.countries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Giving by country</CardTitle>
            <CardDescription>Total tithe &amp; giving, 12-month sum</CardDescription>
          </CardHeader>
          <CardContent>
            <BarBreakdownChart data={giving} nameKey="name" dataKey="amount" layout="vertical" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

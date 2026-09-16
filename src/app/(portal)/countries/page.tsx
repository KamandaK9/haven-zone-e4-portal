import { CountryGrid } from "@/components/dashboard/country-grid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarBreakdownChart } from "@/components/charts/bar-breakdown-chart";
import { COUNTRIES } from "@/lib/data/seed";
import { getGivingByCountry } from "@/lib/data/analytics";

export default function CountriesPage() {
  const giving = getGivingByCountry();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Countries</h1>
        <p className="text-sm text-muted-foreground">
          All {COUNTRIES.length} countries covered by Haven Zone E4.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <CountryGrid countries={COUNTRIES} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Giving by country</CardTitle>
          <CardDescription>Total tithe &amp; giving, 12-month sum</CardDescription>
        </CardHeader>
        <CardContent>
          <BarBreakdownChart data={giving} nameKey="name" dataKey="amount" layout="vertical" />
        </CardContent>
      </Card>
    </div>
  );
}

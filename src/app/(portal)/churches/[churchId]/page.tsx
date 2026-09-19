import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, HandCoins, Clock, CalendarDays } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MemberTable } from "@/components/members/member-table";
import { getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getDisplayCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/currency";
import {
  getChurch,
  getChurchStats,
  getCountry,
  getMembersByChurch,
} from "@/lib/data/analytics";

export default async function ChurchPage({
  params,
}: {
  params: Promise<{ churchId: string }>;
}) {
  const { churchId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const ds = await getZoneDataset(profile.zoneId);
  const { currency, rates } = await getDisplayCurrency(profile.zoneCurrency);
  const church = getChurch(ds, churchId);

  if (!church) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Zone Dashboard", href: "/dashboard" }, { label: "Not found" }]} />
        <p className="text-sm text-muted-foreground">This church doesn&apos;t exist.</p>
        <Link href="/countries" className="text-sm text-primary hover:underline">
          Back to countries
        </Link>
      </div>
    );
  }

  const country = getCountry(ds, church.countryId);
  const stats = getChurchStats(ds, church.id);
  const members = getMembersByChurch(ds, church.id);
  const subline = [church.city, country?.name, church.pastor].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Zone Dashboard", href: "/dashboard" },
          { label: country?.name ?? "Country", href: `/countries/${church.countryId}` },
          { label: church.name },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{church.name}</h1>
        {subline && <p className="text-sm text-muted-foreground">{subline}</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Members" value={stats.memberCount.toLocaleString()} icon={Users} />
        <StatCard label="Total giving" value={formatMoney(stats.totalGiving, currency, rates)} icon={HandCoins} />
        <StatCard label="Avg. tenure" value={`${stats.avgTenure.toFixed(1)} yrs`} icon={Clock} />
        <StatCard label="Founded" value={church.foundedYear ? String(church.foundedYear) : "—"} icon={CalendarDays} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Search, filter, or add a member for {church.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberTable
            members={members}
            churchId={church.id}
            countryId={church.countryId}
            churchName={church.name}
          />
        </CardContent>
      </Card>
    </div>
  );
}

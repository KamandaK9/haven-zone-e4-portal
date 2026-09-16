import { notFound } from "next/navigation";
import { Users, HandCoins, Clock, CalendarDays } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MemberTable } from "@/components/members/member-table";
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
  const church = getChurch(churchId);
  if (!church) notFound();

  const country = getCountry(church.countryId);
  const stats = getChurchStats(churchId);
  const members = getMembersByChurch(churchId);

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
        <p className="text-sm text-muted-foreground">
          {church.city}, {country?.name} &middot; {church.pastor}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Members" value={stats.memberCount.toLocaleString()} icon={Users} />
        <StatCard label="Total giving" value={`$${stats.totalGiving.toLocaleString()}`} icon={HandCoins} />
        <StatCard label="Avg. tenure" value={`${stats.avgTenure.toFixed(1)} yrs`} icon={Clock} />
        <StatCard label="Founded" value={String(church.foundedYear)} icon={CalendarDays} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Search, filter, or add a member for {church.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <MemberTable
            initialMembers={members}
            churchId={church.id}
            countryId={church.countryId}
            churchName={church.name}
          />
        </CardContent>
      </Card>
    </div>
  );
}

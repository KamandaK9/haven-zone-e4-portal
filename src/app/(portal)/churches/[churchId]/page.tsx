import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, HandCoins, Clock, CalendarDays, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MemberTable } from "@/components/members/member-table";
import { CellsDirectory } from "@/components/cells/cells-directory";
import { RenameChapterDialog } from "@/components/dashboard/rename-chapter-dialog";
import { GivingCategorySelect } from "@/components/dashboard/giving-category-select";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getChapterCells } from "@/lib/data/cells";
import { getDisplayCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/currency";
import {
  getChurch,
  getChurchStats,
  getCountry,
  getMembersByChurch,
  memberFullName,
} from "@/lib/data/analytics";
import { givingFilterLabel, parseGivingFilter } from "@/lib/giving";
import { tenant } from "@/tenant";

export default async function ChurchPage({
  params,
  searchParams,
}: {
  params: Promise<{ churchId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { churchId } = await params;
  const givingFilter = parseGivingFilter((await searchParams).giving);
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
  const stats = getChurchStats(ds, church.id, givingFilter);
  const members = getMembersByChurch(ds, church.id);
  const { cells, available: cellsAvailable } = await getChapterCells(church.id);
  const cellNames = Object.fromEntries(cells.map((c) => [c.id, c.name]));
  const levels = tenant.records.cellLevels;
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

      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{church.name}</h1>
          {subline && <p className="text-sm text-muted-foreground">{subline}</p>}
        </div>
        {can(profile, "manage_members") && (
          <RenameChapterDialog churchId={church.id} currentName={church.name} size="default" />
        )}
      </div>

      <div className="flex items-center justify-end">
        <GivingCategorySelect value={givingFilter} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Members" value={stats.memberCount.toLocaleString()} icon={Users} />
        <StatCard
          label={givingFilter === "all" ? "Total giving" : `${givingFilterLabel(givingFilter)} giving`}
          value={formatMoney(stats.totalGiving, currency, rates)}
          icon={HandCoins}
        />
        <StatCard label="Avg. tenure" value={stats.avgTenure > 0 ? `${stats.avgTenure.toFixed(1)} yrs` : "—"} icon={Clock} />
        <StatCard label="Founded" value={church.foundedYear ? String(church.foundedYear) : "—"} icon={CalendarDays} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Members</CardTitle>
            <CardDescription>Search, filter, or add a member for {church.name}</CardDescription>
          </div>
          {can(profile, "manage_members") && (
            <Button variant="outline" size="sm" className="gap-2 shrink-0" asChild>
              <Link href="/members/duplicates">
                <Copy className="h-3.5 w-3.5" />
                Find duplicates
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <MemberTable
            members={members}
            churchId={church.id}
            countryId={church.countryId}
            churchName={church.name}
            showGiving={ds.individualGiving}
            canManage={can(profile, "manage_members")}
            cellNames={cells.length > 0 ? cellNames : undefined}
          />
        </CardContent>
      </Card>

      {cellsAvailable && (
        <Card id="cells" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>
              {levels.upperPlural} &amp; {levels.lowerPlural.toLowerCase()}
            </CardTitle>
            <CardDescription>
              Who belongs where in {church.name}, who leads each group, and when they meet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CellsDirectory
              churchId={church.id}
              cells={cells}
              members={members
                .map((m) => ({ id: m.id, name: memberFullName(m), cellId: m.cellId }))
                .sort((a, b) => a.name.localeCompare(b.name))}
              canManage={can(profile, "manage_members")}
              levels={levels}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

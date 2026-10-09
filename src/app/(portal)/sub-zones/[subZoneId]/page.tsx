import Link from "next/link";
import { redirect } from "next/navigation";
import { Church as ChurchIcon, Network, Users, CalendarDays } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditSubZoneDialog, MoveChapterSelect } from "@/components/structure/sub-zone-dialogs";
import { LeaderHistory } from "@/components/structure/leader-history";
import { can, getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getMembersByChurch } from "@/lib/data/analytics";
import { getZoneCells } from "@/lib/data/cells";
import { getLeadershipHistory } from "@/lib/data/structure";
import { positionLabel } from "@/lib/access";
import { labels, lower } from "@/lib/labels";
import { groupBySubZone, holdersOf, leadershipTimeline } from "@/lib/structure";
import { pluralize } from "@/lib/utils";
import { tenant } from "@/tenant";

// One sub-zone: its story, its leader now and before, and its locations by
// country, each with its own leader.
export default async function SubZonePage({ params }: { params: Promise<{ subZoneId: string }> }) {
  const { subZoneId } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const ds = await getZoneDataset(profile.zoneId);
  const subZone = ds.subZones.find((z) => z.id === subZoneId);
  const crumbs = [
    { label: "Dashboard", href: "/dashboard" },
    { label: labels.subZones, href: "/sub-zones" },
  ];

  if (!subZone) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[...crumbs, { label: "Not found" }]} />
        <p className="text-sm text-muted-foreground">This {lower(labels.subZone)} doesn&apos;t exist.</p>
      </div>
    );
  }

  const group = groupBySubZone([subZone], ds.countries, ds.churches).find((g) => g.subZone?.id === subZoneId)!;
  const churchIds = new Set(group.countries.flatMap((c) => c.churches.map((ch) => ch.id)));
  const memberCount = [...churchIds].reduce((n, id) => n + getMembersByChurch(ds, id).length, 0);
  const cells = (await getZoneCells(profile.zoneId)).filter((c) => churchIds.has(c.churchId));
  const groupLeaderKey = tenant.access.groupLeaderPositionKey;
  const locationLeaderKey = tenant.access.locationLeaderPositionKey;
  const leaders = holdersOf(ds.members, groupLeaderKey, churchIds);
  const history = leadershipTimeline(await getLeadershipHistory(subZoneId, groupLeaderKey));
  const isDirector = profile.role === "super_admin" || can(profile, "manage_settings");
  const leaderTitle = groupLeaderKey ? positionLabel(groupLeaderKey) : "Leader";

  return (
    <div className="space-y-6">
      <Breadcrumb items={[...crumbs, { label: subZone.name }]} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{subZone.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[group.countries.map((c) => `${c.country.flag} ${c.country.name}`).join(" · "), subZone.foundedYear && `Since ${subZone.foundedYear}`]
              .filter(Boolean)
              .join(" · ") || `No ${lower(labels.locations)} yet`}
          </p>
        </div>
        {isDirector && <EditSubZoneDialog subZoneId={subZone.id} name={subZone.name} foundedYear={subZone.foundedYear} history={subZone.history} />}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={labels.locations} value={group.churchCount.toLocaleString()} icon={ChurchIcon} />
        <StatCard label="Members" value={memberCount.toLocaleString()} icon={Users} />
        <StatCard label={labels.cells} value={cells.length.toLocaleString()} icon={Network} />
        <StatCard label="Began" value={subZone.foundedYear ? String(subZone.foundedYear) : "—"} icon={CalendarDays} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>The story of {subZone.name}.</CardDescription>
          </CardHeader>
          <CardContent>
            {subZone.history ? (
              <p className="whitespace-pre-line text-sm leading-relaxed">{subZone.history}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not written yet{isDirector ? " — choose Edit to add how it started and grew." : "."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{leaderTitle}</CardTitle>
            <CardDescription>
              {leaders.length > 0 ? (
                leaders.map((m, i) => (
                  <span key={m.id}>
                    {i > 0 && ", "}
                    <Link href={`/members/${m.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                      {m.firstName} {m.lastName}
                    </Link>
                  </span>
                ))
              ) : (
                <>No current {leaderTitle.toLowerCase()} on record.</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Over the years</p>
            <LeaderHistory subZoneId={subZone.id} entries={history} leaderTitle={leaderTitle} canEdit={isDirector} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{labels.locations}</CardTitle>
          <CardDescription>
            {pluralize(group.churchCount, lower(labels.location), lower(labels.locations))} in {subZone.name}
            {locationLeaderKey ? `, each with its ${positionLabel(locationLeaderKey)}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {group.countries.length === 0 && (
            <p className="text-sm text-muted-foreground">
              None yet{isDirector ? ` — move ${lower(labels.locations)} in from another ${lower(labels.subZone)}'s page.` : "."}
            </p>
          )}
          {group.countries.map(({ country, churches }) => (
            <div key={country.id} className="space-y-2">
              <p className="text-sm font-medium">
                {country.flag} {country.name}
              </p>
              <div className="divide-y rounded-xl border">
                {churches.map((church) => {
                  const governors = holdersOf(ds.members, locationLeaderKey, new Set([church.id]));
                  const churchCells = cells.filter((c) => c.churchId === church.id).length;
                  return (
                    <div key={church.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <Link href={`/churches/${church.id}`} className="text-sm font-medium hover:text-primary hover:underline">
                          {church.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          {locationLeaderKey &&
                            `${positionLabel(locationLeaderKey)}: ${governors.length ? governors.map((m) => `${m.firstName} ${m.lastName}`).join(", ") : "not recorded"} · `}
                          {pluralize(getMembersByChurch(ds, church.id).length, "member")} · {pluralize(churchCells, lower(labels.cell), lower(labels.cells))}
                        </p>
                      </div>
                      {isDirector && <MoveChapterSelect churchId={church.id} subZoneId={church.subZoneId} subZones={ds.subZones} />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {isDirector && <LooseChapters ds={ds} subZones={ds.subZones} />}
    </div>
  );
}

// For Directors: locations not in any sub-zone, ready to be moved in.
function LooseChapters({ ds, subZones }: { ds: Awaited<ReturnType<typeof getZoneDataset>>; subZones: { id: string; name: string }[] }) {
  const loose = groupBySubZone(subZones, ds.countries, ds.churches).find((g) => !g.subZone);
  if (!loose) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Not in a {lower(labels.subZone)} yet</CardTitle>
        <CardDescription>Choose where each belongs.</CardDescription>
      </CardHeader>
      <CardContent className="divide-y rounded-xl border p-0">
        {loose.countries.flatMap(({ country, churches }) =>
          churches.map((church) => (
            <div key={church.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
              <Link href={`/churches/${church.id}`} className="flex-1 text-sm font-medium hover:text-primary hover:underline">
                {country.flag} {church.name}
              </Link>
              <MoveChapterSelect churchId={church.id} subZones={subZones} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

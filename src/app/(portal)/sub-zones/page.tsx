import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Network, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AddSubZoneDialog } from "@/components/structure/sub-zone-dialogs";
import { can, getCurrentProfile, getMemberCounts, getZoneDataset } from "@/lib/data/get-dataset";
import { positionLabel } from "@/lib/access";
import { labels, lower } from "@/lib/labels";
import { commonLeadingWord, groupBySubZone, holdersOf, structureIssues } from "@/lib/structure";
import { pluralize } from "@/lib/utils";
import { tenant } from "@/tenant";

// The structure, sub-zone first: each sub-zone with its countries, its
// leader and how many locations it has.
export default async function SubZonesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  // Leaders only (for names); everyone else is counted in the database.
  const [ds, counts] = await Promise.all([getZoneDataset(profile.zoneId, { leadersOnly: true }), getMemberCounts()]);
  const groups = groupBySubZone(ds.subZones, ds.countries, ds.churches, { includeEmpty: profile.scope === "zone" });
  const leaderKey = tenant.access.groupLeaderPositionKey;
  const isDirector = profile.role === "super_admin" || can(profile, "manage_settings");
  // Locations that look off (wrong country, twins, not placed) — leaders
  // aren't counted here, only things the tidy-up tools fix.
  const real = ds.churches.filter((c) => !c.isOffice);
  const needsTidying = isDirector
    ? [...structureIssues(real, ds.countries, () => 1, { orgWord: commonLeadingWord(real.map((c) => c.name)), checkLeaders: false }).values()].filter(
        (list) => list.length > 0
      ).length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{labels.subZones}</h1>
          <p className="text-sm text-muted-foreground">
            {ds.zoneName} by {lower(labels.subZone)} — then {lower(labels.country)}, {lower(labels.locations)} and{" "}
            {lower(labels.cells)}.
          </p>
        </div>
        {isDirector && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" asChild>
              <Link href="/sub-zones/tidy">
                <Wrench className="h-3.5 w-3.5" /> Tidy up
              </Link>
            </Button>
            <AddSubZoneDialog />
          </div>
        )}
      </div>

      {needsTidying > 0 && (
        <Link
          href="/sub-zones/tidy"
          className="block rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm hover:border-amber-500/70"
        >
          {pluralize(needsTidying, lower(labels.location), lower(labels.locations))} may need fixing — wrong{" "}
          {lower(labels.country)}, possible duplicates, or not in a {lower(labels.subZone)}. <span className="font-medium underline">Tidy up →</span>
        </Link>
      )}

      {groups.length === 0 && (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No {lower(labels.subZones)} yet.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups
          .filter((g) => g.subZone)
          .map(({ subZone, countries, churchCount }) => {
            const churchIds = new Set(countries.flatMap((c) => c.churches.map((ch) => ch.id)));
            const memberCount = [...churchIds].reduce((n, id) => n + (counts.get(id)?.total ?? 0), 0);
            const leaders = holdersOf(ds.members, leaderKey, churchIds);
            return (
              <Link
                key={subZone!.id}
                href={`/sub-zones/${subZone!.id}`}
                className="group flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium transition-colors group-hover:text-primary">{subZone!.name}</p>
                  <p className="truncate text-sm">
                    {countries.length > 0 ? countries.map((c) => `${c.country.flag} ${c.country.name}`).join(" · ") : "No locations yet"}
                  </p>
                  {leaderKey && (
                    <p className="truncate text-xs text-muted-foreground">
                      {positionLabel(leaderKey)}: {leaders.length ? leaders.map((m) => `${m.firstName} ${m.lastName}`).join(", ") : "not recorded"}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {pluralize(churchCount, lower(labels.location), lower(labels.locations))} &middot; {pluralize(memberCount, "member")}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            );
          })}
      </div>

      {groups
        .filter((g) => !g.subZone)
        .map(({ countries, churchCount }) => (
          <Card key="loose">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Network className="h-4 w-4" /> Not in a {lower(labels.subZone)} yet
              </CardTitle>
              <CardDescription>
                {pluralize(churchCount, lower(labels.location), lower(labels.locations))}
                {isDirector ? ` — open a ${lower(labels.subZone)} to move them in.` : "."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {countries.flatMap(({ country, churches }) =>
                churches.map((c) => (
                  <Link key={c.id} href={`/churches/${c.id}`} className="rounded-full border px-3 py-1 text-sm hover:border-primary/40 hover:text-primary">
                    {country.flag} {c.name}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}

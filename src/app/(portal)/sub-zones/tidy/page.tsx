import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { StructureTidy, type TidyRow } from "@/components/structure/structure-tidy";
import { can, getCurrentProfile, getMemberCounts, getZoneDataset } from "@/lib/data/get-dataset";
import { getZoneCells } from "@/lib/data/cells";
import { positionLabel } from "@/lib/access";
import { labels, lower } from "@/lib/labels";
import { commonLeadingWord, holdersOf, structureIssues } from "@/lib/structure";
import { tenant } from "@/tenant";

// Tidying the structure after an import: every location with what looks
// off about it, and the tools to fix it in place.
export default async function StructureTidyPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (profile.role !== "super_admin" && !can(profile, "manage_settings")) redirect("/sub-zones");
  // Leaders only (for names); everyone else is counted in the database.
  const [ds, counts] = await Promise.all([getZoneDataset(profile.zoneId, { leadersOnly: true }), getMemberCounts()]);
  const cells = await getZoneCells(profile.zoneId);
  const leaderKey = tenant.access.locationLeaderPositionKey;
  const churches = ds.churches.filter((c) => !c.isOffice);
  const issues = structureIssues(churches, ds.countries, (id) => holdersOf(ds.members, leaderKey, new Set([id])).length, {
    orgWord: commonLeadingWord(churches.map((c) => c.name)),
    checkLeaders: !!leaderKey,
  });

  const rows: TidyRow[] = churches
    .map((c) => ({
      id: c.id,
      name: c.name,
      countryId: c.countryId,
      subZoneId: c.subZoneId,
      memberCount: (counts.get(c.id)?.total ?? 0),
      cellCount: cells.filter((cell) => cell.churchId === c.id).length,
      leaders: holdersOf(ds.members, leaderKey, new Set([c.id])).map((m) => `${m.firstName} ${m.lastName}`),
      issues: issues.get(c.id) ?? [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: labels.subZones, href: "/sub-zones" }, { label: "Tidy up" }]} />
        <h1 className="text-2xl font-semibold tracking-tight">Tidy up the structure</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every {lower(labels.location)}, with anything that looks off after the import flagged. Fix it right here: the{" "}
          {lower(labels.country)}, the {lower(labels.subZone)}, the name — or merge two that are really the same place.
          Flags are only hints; you know best.
        </p>
      </div>
      <StructureTidy
        rows={rows}
        countries={ds.countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag }))}
        subZones={ds.subZones.map((z) => ({ id: z.id, name: z.name }))}
        leaderTitle={leaderKey ? positionLabel(leaderKey) : undefined}
      />
    </div>
  );
}

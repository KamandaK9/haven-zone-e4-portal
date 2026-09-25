import type { CurrentProfile } from "@/lib/data/get-dataset";
import type { Dataset } from "@/lib/data/analytics";

// What a leader's dashboard is "of": the zone, their sub-zone, or their chapter.
export function describeScope(profile: Pick<CurrentProfile, "scope" | "subZoneId" | "churchId" | "zoneName">, ds: Dataset): string {
  if (profile.scope === "sub_zone") {
    const subZone = ds.subZones.find((z) => z.id === profile.subZoneId);
    return subZone ? `${subZone.name}` : "your sub-zone";
  }
  if (profile.scope === "chapter") {
    return ds.churches.find((c) => c.id === profile.churchId)?.name ?? "your chapter";
  }
  return profile.zoneName;
}

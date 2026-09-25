import { Landmark, Globe2, Users, Tent, Sparkles, type LucideIcon } from "lucide-react";

// The five annual flagship events. `slug` is the URL and the stable key a
// zone's event_series rows are matched on; the name and description are
// editable after they're seeded.
export const EVENT_SERIES_DEFS: { slug: string; name: string; shortName: string; icon: LucideIcon }[] = [
  { slug: "national-executive-assembly", name: "National Executive Assembly", shortName: "Executive Assembly", icon: Landmark },
  { slug: "international-convention", name: "The Haven International Convention", shortName: "International Convention", icon: Globe2 },
  { slug: "zonal-convention", name: "The Haven Zonal Convention", shortName: "Zonal Convention", icon: Users },
  { slug: "camp-meeting", name: "The Haven Camp Meeting", shortName: "Camp Meeting", icon: Tent },
  { slug: "special-programmes", name: "Special Programmes", shortName: "Special Programmes", icon: Sparkles },
];

// A plain lookup table (rather than a function) so components can pick an
// icon at render time without "creating a component during render".
export const SERIES_ICON_BY_SLUG: Record<string, LucideIcon> = Object.fromEntries(
  EVENT_SERIES_DEFS.map((s) => [s.slug, s.icon])
);

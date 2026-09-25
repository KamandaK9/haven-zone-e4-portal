import type { LucideIcon } from "lucide-react";
import type { EventSeriesDef } from "@/lib/tenant";
import { tenant } from "@/tenant";

// The tenant's flagship event series. `slug` is the URL and the stable key a
// zone's event_series rows are matched on; the name and description are
// editable after they're seeded.
export const EVENT_SERIES_DEFS: readonly EventSeriesDef[] = tenant.eventSeries;

// A plain lookup table (rather than a function) so components can pick an
// icon at render time without "creating a component during render".
export const SERIES_ICON_BY_SLUG: Record<string, LucideIcon> = Object.fromEntries(
  EVENT_SERIES_DEFS.map((s) => [s.slug, s.icon])
);

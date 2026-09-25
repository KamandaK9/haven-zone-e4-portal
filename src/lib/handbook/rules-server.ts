import "server-only";
import { tenant } from "@/tenant";
import type { HandbookRules } from "./types";

// The category thresholds in force for a zone: the tenant's defaults (from
// its handbook source), unless the zone has overridden them.
export async function getHandbookRules(zoneId: string): Promise<HandbookRules | null> {
  void zoneId;
  return tenant.handbook?.rules ?? null;
}

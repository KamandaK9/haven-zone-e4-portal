import "server-only";
import { notFound } from "next/navigation";
import type { ModuleKey } from "@/lib/tenant";
import { getModules } from "@/lib/modules-server";

// Call at the top of a route's page.tsx for a feature area: 404 unless the
// feature is in the plan (tenant.modules) and switched on (Settings →
// Features). The nav hides the item too (src/lib/nav-items.ts).
export async function requireModule(key: ModuleKey): Promise<void> {
  if (!(await getModules())[key]) notFound();
}

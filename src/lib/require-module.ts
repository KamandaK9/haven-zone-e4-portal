import "server-only";
import { notFound } from "next/navigation";
import { tenant } from "@/tenant";
import type { ModuleKey } from "@/lib/tenant";

// Call at the top of a route's page.tsx for a feature area gated by
// TenantConfig.modules (src/lib/nav-items.ts hides the nav item; this is
// the route itself, for anyone who has the URL).
export function requireModule(key: ModuleKey): void {
  if (!tenant.modules[key]) notFound();
}

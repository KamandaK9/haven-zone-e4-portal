"use client";

import { getVisibleNavItems, type StaffRole } from "@/lib/nav-items";
import type { Modules } from "@/lib/modules";
import { PortalSidebar } from "./portal-shell";
import { labels } from "@/lib/labels";

export function SidebarNav({
  zoneName,
  role,
  caps,
  hiddenNavItems,
  modules,
}: {
  zoneName: string;
  role: StaffRole;
  caps: string[];
  hiddenNavItems: string[];
  modules: Modules;
}) {
  const visibleItems = getVisibleNavItems(role, caps, hiddenNavItems, modules);
  const navItems = visibleItems.filter((item) => item.key !== "settings");
  const settingsItem = visibleItems.find((item) => item.key === "settings");

  return <PortalSidebar zoneName={zoneName} subtitle={`${labels.zone} Portal`} navItems={navItems} settingsItem={settingsItem} />;
}

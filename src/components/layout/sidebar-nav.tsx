"use client";

import { getVisibleNavItems, type StaffRole } from "@/lib/nav-items";
import { PortalSidebar } from "./portal-shell";

export function SidebarNav({
  zoneName,
  role,
  caps,
  hiddenNavItems,
}: {
  zoneName: string;
  role: StaffRole;
  caps: string[];
  hiddenNavItems: string[];
}) {
  const visibleItems = getVisibleNavItems(role, caps, hiddenNavItems);
  const navItems = visibleItems.filter((item) => item.key !== "settings");
  const settingsItem = visibleItems.find((item) => item.key === "settings");

  return <PortalSidebar zoneName={zoneName} subtitle="Zone Portal" navItems={navItems} settingsItem={settingsItem} />;
}

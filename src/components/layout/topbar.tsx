"use client";

import { getVisibleNavItems, type StaffRole } from "@/lib/nav-items";
import type { Modules } from "@/lib/modules";
import { PortalTopbar } from "./portal-shell";

export function Topbar({
  zoneName,
  fullName,
  positionLabel,
  role,
  caps,
  hiddenNavItems,
  modules,
}: {
  zoneName: string;
  fullName: string;
  // The person's position ("Group Pastor"), shown under their name.
  positionLabel: string;
  role: StaffRole;
  caps: string[];
  hiddenNavItems: string[];
  modules: Modules;
}) {
  const visibleItems = getVisibleNavItems(role, caps, hiddenNavItems, modules);
  const navItems = visibleItems.filter((item) => item.key !== "settings");
  const settingsItem = visibleItems.find((item) => item.key === "settings");

  return (
    <PortalTopbar
      zoneName={zoneName}
      fullName={fullName}
      identityLabel={positionLabel}
      navItems={navItems}
      settingsItem={settingsItem}
      showNotifications
    />
  );
}

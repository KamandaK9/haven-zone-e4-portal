"use client";

import { getVisibleNavItems, type StaffRole } from "@/lib/nav-items";
import { PortalTopbar } from "./portal-shell";

export function Topbar({
  zoneName,
  fullName,
  role,
  caps,
  hiddenNavItems,
}: {
  zoneName: string;
  fullName: string;
  role: StaffRole;
  caps: string[];
  hiddenNavItems: string[];
}) {
  const visibleItems = getVisibleNavItems(role, caps, hiddenNavItems);
  const navItems = visibleItems.filter((item) => item.key !== "settings");
  const settingsItem = visibleItems.find((item) => item.key === "settings");

  return (
    <PortalTopbar
      zoneName={zoneName}
      fullName={fullName}
      identityLabel={`${zoneName} Office`}
      navItems={navItems}
      settingsItem={settingsItem}
      showNotifications
    />
  );
}

"use client";

import { getVisibleNavItems, type StaffRole } from "@/lib/nav-items";
import { PortalTopbar } from "./portal-shell";

export function Topbar({
  zoneName,
  fullName,
  positionLabel,
  role,
  caps,
  hiddenNavItems,
}: {
  zoneName: string;
  fullName: string;
  // The person's position ("Group Pastor"), shown under their name.
  positionLabel: string;
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
      identityLabel={positionLabel}
      navItems={navItems}
      settingsItem={settingsItem}
      showNotifications
    />
  );
}

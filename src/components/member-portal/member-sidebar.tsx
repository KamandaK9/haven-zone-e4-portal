"use client";

import { LayoutDashboard, CalendarDays, GraduationCap, User } from "lucide-react";
import { PortalSidebar, type PortalNavItem } from "@/components/layout/portal-shell";

// Fixed: a member's own nav never depends on capabilities, just these pages
// — plus Annual events, which PortalSidebar always includes.
export const MEMBER_NAV_ITEMS: PortalNavItem[] = [
  { key: "dashboard", href: "/me", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { key: "calendar", href: "/me/calendar", label: "Calendar", icon: CalendarDays },
  { key: "training", href: "/me/training", label: "Training", icon: GraduationCap },
  { key: "profile", href: "/me/profile", label: "Profile", icon: User },
];

export function MemberSidebar({ zoneName }: { zoneName: string }) {
  return <PortalSidebar zoneName={zoneName} subtitle="Member Portal" navItems={MEMBER_NAV_ITEMS} />;
}

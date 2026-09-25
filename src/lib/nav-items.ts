import type { LucideIcon } from "lucide-react";
import type { Capability } from "@/lib/access";
import { EVENT_SERIES_DEFS } from "@/lib/event-series";
import { LayoutDashboard, Globe2, BarChart3, BookOpenText, GraduationCap, CalendarDays, Mail, Settings, BookMarked, FolderOpen, Radio } from "lucide-react";
import { tenant } from "@/tenant";

export type StaffRole = "super_admin" | "admin";

export type NavItemDef = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  // Capability needed to see this item (any of them, for a list); omitted = any leader.
  cap?: Capability | Capability[];
  hideable: boolean; // can the Zonal Director hide this from their own nav?
};

export const NAV_ITEMS: NavItemDef[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hideable: false },
  { key: "countries", href: "/countries", label: "Countries", icon: Globe2, hideable: false },
  { key: "reports", href: "/reports", label: "Reports", icon: BarChart3, cap: "view_reports", hideable: true },
  { key: "ledger", href: "/ledger", label: "Ledger", icon: BookOpenText, cap: "manage_ledger", hideable: true },
  { key: "records", href: "/records", label: "Records", icon: FolderOpen, cap: ["manage_records", "manage_ledger"], hideable: true },
  { key: "training", href: "/training", label: "Training", icon: GraduationCap, hideable: true },
  { key: "calendar", href: "/calendar", label: "Calendar", icon: CalendarDays, hideable: false },
  { key: "live", href: "/live", label: "Live", icon: Radio, hideable: true },
  // Only when the tenant ships a handbook.
  ...(tenant.handbook
    ? [{ key: "handbook", href: "/handbook", label: tenant.handbook.title, icon: BookMarked, hideable: true }]
    : []),
  { key: "newsletter", href: "/newsletter", label: "Newsletter", icon: Mail, cap: "send_newsletter", hideable: true },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings, cap: "manage_access", hideable: false },
];

export function getVisibleNavItems(role: StaffRole, caps: string[], hiddenNavItems: string[]): NavItemDef[] {
  return NAV_ITEMS.filter((item) => {
    if (item.cap && ![item.cap].flat().some((c) => caps.includes(c))) return false;
    // Only a Director's own hidden-items preference ever applies — other
    // leaders get a nav fixed by their capabilities.
    if (role === "super_admin" && item.hideable && hiddenNavItems.includes(item.key)) return false;
    return true;
  });
}

// The five annual flagship events, listed under their own heading in the
// sidebar. Every leader sees them (and members reach them via Events).
export const EVENT_NAV_ITEMS: { key: string; href: string; label: string; icon: LucideIcon }[] = EVENT_SERIES_DEFS.map(
  (s) => ({ key: s.slug, href: `/events/${s.slug}`, label: s.shortName, icon: s.icon })
);

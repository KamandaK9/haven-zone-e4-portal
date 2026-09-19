import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Globe2, BarChart3, BookOpenText, GraduationCap, CalendarDays, Mail, Settings } from "lucide-react";

export type StaffRole = "super_admin" | "admin";

export type NavItemDef = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  roles: StaffRole[];
  hideable: boolean; // can the Super Admin hide this from their own nav?
};

export const NAV_ITEMS: NavItemDef[] = [
  { key: "dashboard", href: "/dashboard", label: "Zone Dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin"], hideable: false },
  { key: "countries", href: "/countries", label: "Countries", icon: Globe2, roles: ["super_admin", "admin"], hideable: false },
  { key: "reports", href: "/reports", label: "Reports", icon: BarChart3, roles: ["super_admin"], hideable: true },
  { key: "ledger", href: "/ledger", label: "Ledger", icon: BookOpenText, roles: ["super_admin", "admin"], hideable: true },
  { key: "training", href: "/training", label: "Training", icon: GraduationCap, roles: ["super_admin", "admin"], hideable: true },
  { key: "calendar", href: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["super_admin", "admin"], hideable: false },
  { key: "newsletter", href: "/newsletter", label: "Newsletter", icon: Mail, roles: ["super_admin"], hideable: true },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings, roles: ["super_admin"], hideable: false },
];

export function getVisibleNavItems(role: StaffRole, hiddenNavItems: string[]): NavItemDef[] {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(role)) return false;
    // Only the Super Admin's own hidden-items preference ever applies —
    // Assistants get a fixed nav, no personalization.
    if (role === "super_admin" && item.hideable && hiddenNavItems.includes(item.key)) return false;
    return true;
  });
}

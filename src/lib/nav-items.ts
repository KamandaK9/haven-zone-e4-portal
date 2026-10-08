import type { LucideIcon } from "lucide-react";
import type { Capability } from "@/lib/access";
import type { ModuleKey } from "@/lib/tenant";
import type { Modules } from "@/lib/modules";
import { EVENT_SERIES_DEFS } from "@/lib/event-series";
import { LayoutDashboard, Globe2, Church, ClipboardCheck, ScanLine, School, FolderDown, MessageSquare, UserPlus, ListChecks, Users2, Baby, BarChart3, BookOpenText, GraduationCap, CalendarDays, Mail, Settings, BookMarked, FolderOpen, Radio } from "lucide-react";
import { tenant } from "@/tenant";
import { labels, singleCountry } from "@/lib/labels";

export type StaffRole = "super_admin" | "admin";

export type NavItemDef = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  // Capability needed to see this item (any of them, for a list); omitted = any leader.
  cap?: Capability | Capability[];
  // Feature area this item belongs to; omitted = always on (see ModuleKey).
  module?: ModuleKey;
  hideable: boolean; // can the Zonal Director hide this from their own nav?
};

export const NAV_ITEMS: NavItemDef[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, hideable: false },
  // With a single country the country level is skipped, and this is the
  // list of locations (see /countries).
  {
    key: "countries", href: "/countries", label: singleCountry ? labels.locations : labels.countries,
    icon: singleCountry ? Church : Globe2, hideable: false,
  },
  {
    key: "attendance", href: "/attendance", label: "Attendance", icon: ClipboardCheck,
    cap: "view_attendance", module: "attendance", hideable: true,
  },
  {
    key: "courses", href: "/courses", label: tenant.course?.name ?? "Courses", icon: School,
    cap: ["manage_courses", "teach_courses"], module: "courses", hideable: true,
  },
  {
    key: "messages", href: "/messages", label: "Messages", icon: MessageSquare,
    cap: ["send_messages", "approve_messages"], module: "messaging", hideable: true,
  },
  { key: "cell-meetings", href: "/cell-meetings", label: "Cell meetings", icon: Users2, cap: ["take_cell_attendance", "view_attendance"], module: "attendance", hideable: true },
  { key: "follow-ups", href: "/follow-ups", label: "Follow-ups", icon: ListChecks, cap: "record_follow_up", module: "attendance", hideable: true },
  { key: "first-timers", href: "/first-timers", label: "First-timers", icon: UserPlus, cap: "view_attendance", module: "attendance", hideable: true },
  { key: "children", href: "/children", label: "Children's church", icon: Baby, cap: "check_in", module: "attendance", hideable: true },
  { key: "check-in", href: "/check-in", label: "Check-in", icon: ScanLine, cap: "check_in", module: "attendance", hideable: true },
  { key: "reports", href: "/reports", label: "Reports", icon: BarChart3, cap: "view_reports", hideable: true },
  { key: "ledger", href: "/ledger", label: "Ledger", icon: BookOpenText, cap: "manage_ledger", module: "ledger", hideable: true },
  {
    key: "records", href: "/records", label: "Records", icon: FolderOpen,
    cap: ["manage_records", "manage_ledger"], module: "records", hideable: true,
  },
  { key: "training", href: "/training", label: "Training", icon: GraduationCap, module: "training", hideable: true },
  { key: "calendar", href: "/calendar", label: "Calendar", icon: CalendarDays, hideable: false },
  { key: "live", href: "/live", label: "Live", icon: Radio, module: "livestreams", hideable: true },
  // Only when the tenant ships a handbook.
  ...(tenant.handbook
    ? [{ key: "handbook", href: "/handbook", label: tenant.handbook.title, icon: BookMarked, module: "handbook" as const, hideable: true }]
    : []),
  { key: "resources", href: "/resources", label: "Resources", icon: FolderDown, module: "resources", hideable: true },
  { key: "newsletter", href: "/newsletter", label: "Newsletter", icon: Mail, cap: "send_newsletter", module: "newsletter", hideable: true },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings, cap: "manage_access", hideable: false },
];

// Whether this deployment has the section at all (its module is on). The
// sidebar and Settings → Sidebar sections both use this, so a section that
// can't appear is never offered as a choice either.
export function isNavItemAvailable(item: NavItemDef, modules: Modules): boolean {
  if (item.module && !modules[item.module]) return false;
  // Reports are giving or attendance reports — nothing to show with neither.
  if (item.key === "reports" && !modules.giving && !modules.attendance) return false;
  return true;
}

export function getVisibleNavItems(role: StaffRole, caps: string[], hiddenNavItems: string[], modules: Modules): NavItemDef[] {
  return NAV_ITEMS.filter((item) => {
    if (!isNavItemAvailable(item, modules)) return false;
    if (item.cap && ![item.cap].flat().some((c) => caps.includes(c))) return false;
    // Only a Director's own hidden-items preference ever applies — other
    // leaders get a nav fixed by their capabilities.
    if (role === "super_admin" && item.hideable && hiddenNavItems.includes(item.key)) return false;
    return true;
  });
}

// The zone's flagship events, listed under their own heading in the
// sidebar. Every leader sees them (and members reach them via Events).
// Empty for a tenant with modules.events off, since its eventSeries is
// then [] too — no separate check needed here.
export const EVENT_NAV_ITEMS: { key: string; href: string; label: string; icon: LucideIcon }[] = EVENT_SERIES_DEFS.map(
  (s) => ({ key: s.slug, href: `/events/${s.slug}`, label: s.shortName, icon: s.icon })
);

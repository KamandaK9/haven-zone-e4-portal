"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Menu, Bell, LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOutAction } from "@/lib/actions/auth";
import { EVENT_NAV_ITEMS } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

// The chrome the whole signed-in app shares — a fixed sidebar on desktop, a
// slide-out drawer on mobile — parameterized by which nav items to show.
// Staff (SidebarNav/Topbar) and members (MemberSidebarNav/MemberTopbar) are
// both thin wrappers around this: same look, different item list, so a
// member's portal reads as the same product minus what isn't theirs to see.

// `exact`: match only the exact path, not any sub-route — needed when this
// item's own href is also a literal prefix of a sibling route (e.g. "/me"
// vs "/me/profile"), so the two don't both light up at once.
export type PortalNavItem = { key: string; href: string; label: string; icon: LucideIcon; exact?: boolean };

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "ZA";
}

function NavLink({ item, active }: { item: PortalNavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function isActive(pathname: string, item: PortalNavItem) {
  return pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/"));
}

// Same nav list rendered inside both the fixed desktop sidebar and the
// mobile drawer — annual events always included, same as every leader sees.
function NavList({ navItems, settingsItem }: { navItems: PortalNavItem[]; settingsItem?: PortalNavItem }) {
  const pathname = usePathname();
  return (
    <>
      {navItems.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item)} />
      ))}

      <p className="px-3 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/50">
        Annual events
      </p>
      {EVENT_NAV_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(pathname, item)} />
      ))}

      {settingsItem && (
        <div className="pt-3 mt-3 border-t border-sidebar-border">
          <NavLink item={settingsItem} active={isActive(pathname, settingsItem)} />
        </div>
      )}
    </>
  );
}

export function PortalSidebar({
  zoneName,
  subtitle,
  navItems,
  settingsItem,
}: {
  zoneName: string;
  subtitle: string;
  navItems: PortalNavItem[];
  settingsItem?: PortalNavItem;
}) {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
        <BrandMark size={34} />
        <div className="leading-tight">
          <p className="font-semibold text-sm tracking-tight">{zoneName}</p>
          <p className="text-[11px] text-sidebar-foreground/60">{subtitle}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavList navItems={navItems} />
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        {settingsItem && <NavLink item={settingsItem} active={false} />}
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function PortalTopbar({
  zoneName,
  fullName,
  identityLabel,
  navItems,
  settingsItem,
  showNotifications = false,
}: {
  zoneName: string;
  fullName: string;
  identityLabel: string; // e.g. "Zone Office" or "Member" — the line under their name
  navItems: PortalNavItem[];
  settingsItem?: PortalNavItem;
  showNotifications?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/95 backdrop-blur px-4 md:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground p-0 border-none">
          <SheetHeader className="border-b border-sidebar-border px-5 h-16 flex-row items-center gap-3 space-y-0">
            <BrandMark size={30} />
            <SheetTitle className="text-sidebar-foreground text-sm">{zoneName}</SheetTitle>
          </SheetHeader>
          <nav className="p-3 space-y-1">
            <NavList navItems={navItems} settingsItem={settingsItem} />
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </form>
          </nav>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2 md:hidden">
        <BrandMark size={26} />
        <span className="font-semibold text-sm">{zoneName}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {showNotifications && (
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
          </Button>
        )}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials(fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <p className="text-sm font-medium">{fullName}</p>
            <p className="text-xs text-muted-foreground">{identityLabel}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

// The shared page frame: fixed sidebar + topbar + content area, identical
// for staff and members — only the nav items passed in differ.
export function PortalFrame({
  sidebar,
  topbar,
  children,
}: {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {sidebar}
      <div className="md:pl-64 flex flex-col min-h-screen">
        {topbar}
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

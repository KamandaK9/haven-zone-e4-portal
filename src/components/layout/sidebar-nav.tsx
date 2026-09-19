"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { signOutAction } from "@/lib/actions/auth";
import { getVisibleNavItems, type StaffRole } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

export function SidebarNav({
  zoneName,
  role,
  hiddenNavItems,
}: {
  zoneName: string;
  role: StaffRole;
  hiddenNavItems: string[];
}) {
  const pathname = usePathname();
  const visibleItems = getVisibleNavItems(role, hiddenNavItems);
  const navItems = visibleItems.filter((item) => item.key !== "settings");
  const settingsItem = visibleItems.find((item) => item.key === "settings");

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
        <BrandMark size={34} />
        <div className="leading-tight">
          <p className="font-semibold text-sm tracking-tight">{zoneName}</p>
          <p className="text-[11px] text-sidebar-foreground/60">Member Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
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
        })}
      </nav>

      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        {settingsItem && (
          <Link
            href={settingsItem.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              pathname === settingsItem.href
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <settingsItem.icon className="h-4 w-4" />
            {settingsItem.label}
          </Link>
        )}
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

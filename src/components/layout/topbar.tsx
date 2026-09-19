"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Bell, LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { signOutAction } from "@/lib/actions/auth";
import { getVisibleNavItems, type StaffRole } from "@/lib/nav-items";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "ZA";
}

export function Topbar({
  zoneName,
  fullName,
  role,
  hiddenNavItems,
}: {
  zoneName: string;
  fullName: string;
  role: StaffRole;
  hiddenNavItems: string[];
}) {
  const pathname = usePathname();
  const visibleItems = getVisibleNavItems(role, hiddenNavItems);
  const navItems = visibleItems.filter((item) => item.key !== "settings");
  const settingsItem = visibleItems.find((item) => item.key === "settings");

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
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            {settingsItem && (
              <Link
                href={settingsItem.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === settingsItem.href
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                )}
              >
                <settingsItem.icon className="h-4 w-4" />
                {settingsItem.label}
              </Link>
            )}
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
        </Button>
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials(fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <p className="text-sm font-medium">{fullName}</p>
            <p className="text-xs text-muted-foreground">{zoneName} Office</p>
          </div>
        </div>
      </div>
    </header>
  );
}

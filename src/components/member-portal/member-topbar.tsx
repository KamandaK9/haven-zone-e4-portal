"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, CalendarDays, LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/me", label: "Profile", icon: User },
  { href: "/me/calendar", label: "Calendar", icon: CalendarDays },
];

export function MemberTopbar({ zoneName }: { zoneName: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b bg-card">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <BrandMark size={28} />
          <span className="font-semibold text-sm hidden sm:inline">{zoneName}</span>
        </div>
        <nav className="flex items-center gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, LifeBuoy, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SupportDialog } from "@/components/support/support-button";
import type { NotificationItem } from "@/lib/data/notifications";

// The three dots at the top right: what needs attention, and help.
export function MoreMenu({ notifications }: { notifications?: NotificationItem[] }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [helpKey, setHelpKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const total = (notifications ?? []).reduce((n, i) => n + i.count, 0);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label={total > 0 ? `More — ${total} waiting` : "More"}>
            <MoreHorizontal className="h-5 w-5" />
            {total > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {notifications && (
            <DropdownMenuItem onSelect={() => setNotesOpen(true)} className="gap-2">
              <Bell className="h-4 w-4" /> Notifications
              {total > 0 && <span className="ml-auto rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">{total}</span>}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              setHelpKey((k) => k + 1);
              setHelpOpen(true);
            }}
            className="gap-2"
          >
            <LifeBuoy className="h-4 w-4" /> Help
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>What&apos;s waiting for you.</DialogDescription>
          </DialogHeader>
          {total === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {(notifications ?? []).map((n) => (
                <li key={n.key}>
                  <Link href={n.href} onClick={() => setNotesOpen(false)} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-muted/50">
                    <span>{n.label}</span>
                    <span className="rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">{n.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <SupportDialog key={helpKey} open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

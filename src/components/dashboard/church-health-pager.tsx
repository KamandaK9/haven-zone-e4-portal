"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, Minus, TrendingDown } from "lucide-react";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { cn, pluralize } from "@/lib/utils";

export type HealthStatus = "Growing" | "Flat" | "Needs Attention";
export type HealthItem = {
  id: string;
  name: string;
  flag: string;
  country: string;
  memberCount: number;
  status: HealthStatus;
};

const STATUS_STYLES: Record<HealthStatus, { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  Growing: { icon: TrendingUp, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Flat: { icon: Minus, className: "bg-amber-50 text-amber-700 border-amber-200" },
  "Needs Attention": { icon: TrendingDown, className: "bg-red-50 text-red-700 border-red-200" },
};

const PAGE_SIZE = 10;

export function ChurchHealthPager({ items }: { items: HealthItem[] }) {
  const [page, setPage] = useState(1);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
        No chapters yet. Add some from Zone Setup.
      </p>
    );
  }

  const visible = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="divide-y">
        {visible.map((row) => {
          const { icon: Icon, className } = STATUS_STYLES[row.status];
          return (
            <Link
              key={row.id}
              href={`/churches/${row.id}`}
              className="flex items-center justify-between py-2.5 hover:bg-accent -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{row.name}</p>
                <p className="text-xs text-muted-foreground">
                  {row.flag} {row.country} &middot; {pluralize(row.memberCount, "member")}
                </p>
              </div>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0",
                  className
                )}
              >
                <Icon className="h-3 w-3" />
                {row.status}
              </span>
            </Link>
          );
        })}
      </div>
      <PaginationBar page={page} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />
    </div>
  );
}

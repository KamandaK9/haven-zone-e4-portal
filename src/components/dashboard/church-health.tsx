import Link from "next/link";
import { TrendingUp, Minus, TrendingDown } from "lucide-react";
import { getChurchHealth, getCountry, type Dataset } from "@/lib/data/analytics";
import { cn, pluralize } from "@/lib/utils";

type HealthRow = ReturnType<typeof getChurchHealth>[number];

const STATUS_STYLES: Record<HealthRow["status"], { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  Growing: { icon: TrendingUp, className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  Flat: { icon: Minus, className: "bg-amber-50 text-amber-700 border-amber-200" },
  "Needs Attention": { icon: TrendingDown, className: "bg-red-50 text-red-700 border-red-200" },
};

export function ChurchHealthList({ rows, ds }: { rows: HealthRow[]; ds: Dataset }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
        No churches yet. Add some from Zone Setup.
      </p>
    );
  }

  return (
    <div className="divide-y">
      {rows.map(({ church, memberCount, status }) => {
        const country = getCountry(ds, church.countryId);
        const { icon: Icon, className } = STATUS_STYLES[status];
        return (
          <Link
            key={church.id}
            href={`/churches/${church.id}`}
            className="flex items-center justify-between py-2.5 hover:bg-accent -mx-2 px-2 rounded-lg transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{church.name}</p>
              <p className="text-xs text-muted-foreground">
                {country?.flag} {country?.name} &middot; {pluralize(memberCount, "member")}
              </p>
            </div>
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shrink-0",
                className
              )}
            >
              <Icon className="h-3 w-3" />
              {status}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

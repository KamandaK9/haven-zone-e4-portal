import { UserPlus, GraduationCap, Droplets, HandCoins, CalendarClock } from "lucide-react";
import { timeAgo } from "@/lib/data/analytics";
import type { ActivityItem, ActivityType } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  new_member: UserPlus,
  training_complete: GraduationCap,
  baptism: Droplets,
  giving: HandCoins,
  event: CalendarClock,
};

const STYLES: Record<ActivityType, string> = {
  new_member: "bg-violet-100 text-violet-700",
  training_complete: "bg-emerald-100 text-emerald-700",
  baptism: "bg-sky-100 text-sky-700",
  giving: "bg-amber-100 text-amber-700",
  event: "bg-fuchsia-100 text-fuchsia-700",
};

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const Icon = ICONS[item.type];
        return (
          <li key={item.id} className="flex items-start gap-3 rounded-lg px-2 py-2">
            <span className={cn("rounded-full p-1.5 shrink-0", STYLES[item.type])}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{item.message}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(item.timestamp)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

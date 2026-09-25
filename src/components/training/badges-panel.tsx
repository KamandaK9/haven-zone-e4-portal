import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Badge } from "@/lib/badges";
import { cn } from "@/lib/utils";

export function BadgesPanel({ badges }: { badges: Badge[] }) {
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Badges</CardTitle>
        <CardDescription>
          {earnedCount} of {badges.length} earned
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          {badges.map((badge) => {
            const Icon = badge.icon;
            return (
              <div key={badge.id} className="flex flex-col items-center gap-1.5 text-center" title={badge.description}>
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full",
                    badge.earned ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/40"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className={cn("text-[10px] leading-tight", !badge.earned && "text-muted-foreground/60")}>{badge.name}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

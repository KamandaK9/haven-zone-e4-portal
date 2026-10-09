import { Progress } from "@/components/ui/progress";
import type { Usage } from "@/lib/messaging/settings";

export function UsageMeter({ usage }: { usage: Usage }) {
  const pct = usage.cap > 0 ? Math.min(100, Math.round((usage.segments / usage.cap) * 100)) : 100;
  const warn = pct >= 80;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p>
          <span className="text-2xl font-semibold tabular-nums">{usage.segments.toLocaleString()}</span>{" "}
          <span className="text-muted-foreground">of {usage.cap.toLocaleString()} texts used this month</span>
        </p>
        <p className="text-xs text-muted-foreground">≈ US${usage.estimatedCost.toFixed(2)} so far</p>
      </div>
      <Progress value={pct} className={warn ? "h-2 [&>div]:bg-amber-500" : "h-2"} />
      <p className="text-xs text-muted-foreground">
        {usage.remaining > 0 ? `${usage.remaining.toLocaleString()} left — sending stops at the cap.` : "The cap is reached — nothing more will send until next month or the cap is raised."}
      </p>
    </div>
  );
}

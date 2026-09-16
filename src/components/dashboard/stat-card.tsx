import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  className,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  delta?: number;
  deltaLabel?: string;
  className?: string;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card className={cn("shadow-sm gap-3", className)}>
      <CardContent className="flex items-start justify-between px-5">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          {delta !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                positive ? "text-emerald-600" : "text-red-600"
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {Math.abs(delta)}% {deltaLabel}
            </div>
          )}
        </div>
        <div className="rounded-lg bg-accent p-2.5">
          <Icon className="h-4.5 w-4.5 text-accent-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

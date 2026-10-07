"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { setFeatureEnabled } from "@/lib/actions/features";
import { FEATURE_CATALOGUE, type Modules } from "@/lib/modules";
import type { ModuleKey } from "@/lib/tenant";

// Every Stratum feature: the ones in this organisation's plan can be switched
// on and off; the rest show as not in the plan (or coming soon).
export function FeaturesForm({ included, modules, canEdit }: { included: Record<string, boolean>; modules: Modules; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<ModuleKey | null>(null);

  // In the plan first, then the rest, then what's coming.
  const rank = (f: (typeof FEATURE_CATALOGUE)[number]) => (f.comingSoon ? 2 : included[f.key] ? 0 : 1);
  const ordered = [...FEATURE_CATALOGUE].sort((a, b) => rank(a) - rank(b));

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}
      {ordered.map((f) => {
        const inPlan = included[f.key] && !f.comingSoon;
        const on = modules[f.key];
        return (
          <div key={f.key} className={cn("flex items-start gap-4 rounded-lg border p-3", !inPlan && "bg-muted/40")}>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", !inPlan && "text-muted-foreground")}>{f.name}</p>
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
            {f.comingSoon ? (
              <Badge variant="secondary">Coming soon</Badge>
            ) : !inPlan ? (
              <Badge variant="outline" className="whitespace-nowrap">Not in your plan</Badge>
            ) : (
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${f.name}: ${on ? "on" : "off"}`}
                disabled={!canEdit || pending}
                onClick={() => {
                  setError(null);
                  setBusyKey(f.key);
                  start(async () => {
                    const res = await setFeatureEnabled(f.key, !on);
                    setBusyKey(null);
                    if (!res.ok) setError(res.error);
                    else router.refresh();
                  });
                }}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
                  on ? "bg-primary" : "bg-muted-foreground/30",
                  busyKey === f.key && "animate-pulse"
                )}
              >
                <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

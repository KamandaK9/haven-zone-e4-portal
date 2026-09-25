import { cn } from "@/lib/utils";

export type LadderRung = {
  code: string;
  label: string;
  // Sub-label, e.g. a nickname for the tier.
  alias?: string;
  criteria: string[];
  note?: string;
  // Swatch colour; omitted rungs use the primary colour, fading down the ladder.
  color?: string;
  // Live things placed on this rung (chapter names, "You").
  markers?: string[];
  highlight?: boolean;
};

// Best rung on top. Rendered as a list so it reads correctly without styles.
export function TierLadder({ rungs, markerLabel }: { rungs: LadderRung[]; markerLabel?: string }) {
  return (
    <ol className="overflow-hidden rounded-xl border divide-y">
      {rungs.map((rung, i) => (
        <li
          key={rung.code}
          className={cn("flex gap-3 px-4 py-3 sm:items-center", rung.highlight && "bg-primary/5 ring-1 ring-inset ring-primary/30")}
        >
          <span
            aria-hidden
            className="mt-0.5 h-9 w-1.5 shrink-0 rounded-full sm:mt-0"
            style={
              rung.color
                ? { backgroundColor: rung.color }
                : { backgroundColor: "var(--primary)", opacity: Math.max(0.25, 1 - i / Math.max(rungs.length, 1)) }
            }
          />
          <div className="min-w-0 flex-1 gap-x-4 gap-y-1 sm:flex sm:items-center">
            <div className="sm:w-44 sm:shrink-0">
              <p className="font-semibold leading-snug">{rung.label}</p>
              {rung.alias && <p className="text-xs text-muted-foreground">{rung.alias}</p>}
            </div>
            <div className="min-w-0 flex-1 text-sm text-muted-foreground">
              <p>{rung.criteria.join(" · ")}</p>
              {rung.note && <p className="text-xs">{rung.note}</p>}
            </div>
            {rung.markers && rung.markers.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5 sm:mt-0 sm:max-w-[45%] sm:justify-end" aria-label={markerLabel}>
                {rung.markers.map((m) => (
                  <span key={m} className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                    {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

import { Fragment } from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import type { FlowStage } from "@/lib/handbook/types";

// Left-to-right when the container is wide enough, top-to-bottom otherwise
// (a container query, so it adapts to the content column, not the viewport).
export function FlowDiagram({ title, stages }: { title?: string; stages: FlowStage[] }) {
  return (
    <figure className="@container rounded-xl border bg-muted/30 p-4">
      {title && <figcaption className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</figcaption>}
      <div className="flex flex-col items-stretch gap-2 @2xl:flex-row @2xl:items-center">
        {stages.map((stage, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <div className="flex shrink-0 items-center justify-center gap-1.5 text-muted-foreground @2xl:flex-col @2xl:gap-0.5">
                <ArrowDown className="h-4 w-4 @2xl:hidden" />
                <ArrowRight className="hidden h-4 w-4 @2xl:block" />
                {stage.via && <span className="text-[11px] leading-tight @2xl:text-center">{stage.via}</span>}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {stage.nodes.map((node) => (
                <div key={node.label} className="rounded-lg border bg-card px-3 py-2.5 shadow-xs">
                  <p className="text-sm font-medium leading-snug">{node.label}</p>
                  {node.detail && <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{node.detail}</p>}
                </div>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </figure>
  );
}

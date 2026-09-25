import Link from "next/link";
import { ArrowRight, CalendarClock, CheckCircle2, Clock, Info, TriangleAlert, UsersRound } from "lucide-react";
import { FlowDiagram } from "./flow-diagram";
import { OrgChart } from "./org-chart";
import { ProcedureStepper } from "./procedure-stepper";
import { TierLadder, type LadderRung } from "./tier-ladder";
import { ChapterStandings, MyTier, TierDistribution, ZoneStanding, type LiveFormat } from "./live-widgets";
import type { HandbookLive } from "@/lib/handbook/live";
import type { Block, HandbookRules, LadderKind, ListItem, Meeting, PortalFeature, Role } from "@/lib/handbook/types";
import { cn } from "@/lib/utils";

export type HandbookRenderContext = LiveFormat & {
  roles: Role[];
  rules: HandbookRules;
  live: HandbookLive | null;
  zoneName: string;
  // Rule thresholds, always in USD like the source document.
  usd: (amount: number) => string;
  // Event series slugs that exist, so meetings only link to real pages.
  seriesSlugs: string[];
  // Leaders get links into the rest of the portal; members don't have those pages.
  isLeader: boolean;
  // The viewer's own chapter, for links to chapter-level pages.
  homeChapterId?: string | null;
  initialRoleId?: string;
};

const PORTAL_FEATURES: Record<PortalFeature, { label: string; href: (ctx: HandbookRenderContext) => string }> = {
  members: { label: "Members", href: () => "/countries" },
  cells: { label: "Cells", href: (ctx) => (ctx.homeChapterId ? `/churches/${ctx.homeChapterId}#cells` : "/countries") },
  ledger: { label: "Ledger", href: () => "/ledger" },
  reports: { label: "Reports", href: () => "/reports" },
  calendar: { label: "Calendar", href: () => "/calendar" },
  training: { label: "Training", href: () => "/training" },
  minutes: { label: "Minutes", href: () => "/records?tab=minutes" },
  correspondence: { label: "Correspondence", href: () => "/records?tab=correspondence" },
  bankAdvices: { label: "Bank advices", href: () => "/records?tab=bank_advice" },
  cheques: { label: "Cheques", href: () => "/records?tab=cheques" },
};

function ListView({ items, ordered }: { items: ListItem[]; ordered?: boolean }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn("space-y-1.5 pl-5 leading-relaxed marker:text-muted-foreground", ordered ? "list-decimal" : "list-disc")}>
      {items.map((item, i) =>
        typeof item === "string" ? (
          <li key={i}>{item}</li>
        ) : (
          <li key={i}>
            {item.text}
            <div className="mt-1.5">
              <ListView items={item.items} />
            </div>
          </li>
        )
      )}
    </Tag>
  );
}

function MeetingCards({ meetings, ctx }: { meetings: Meeting[]; ctx: HandbookRenderContext }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {meetings.map((m) => (
        <div key={m.name} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="space-y-2">
            <p className="font-semibold leading-snug">{m.name}</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                <CalendarClock className="h-3 w-3" />
                {m.cadence}
              </span>
              {m.deadline && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Clock className="h-3 w-3" />
                  {m.deadline}
                </span>
              )}
            </div>
          </div>
          <p className="flex gap-1.5 text-sm text-muted-foreground">
            <UsersRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {m.attendance}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed marker:text-muted-foreground">
            {m.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {m.seriesSlug && ctx.seriesSlugs.includes(m.seriesSlug) && (
            <Link href={`/events/${m.seriesSlug}`} className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Event page <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

function Ladder({ kind, ctx }: { kind: LadderKind; ctx: HandbookRenderContext }) {
  const { rules, live, usd } = ctx;
  let rungs: LadderRung[];

  if (kind === "chapter") {
    const placed = new Map<string, string[]>();
    for (const c of live?.chapters ?? []) {
      const code = c.placement.rung?.code ?? "";
      placed.set(code, [...(placed.get(code) ?? []), c.name]);
    }
    rungs = rules.chapter.map((r) => ({
      code: r.code,
      label: r.label,
      criteria: [`From ${usd(r.minAmount)} a year`, `${r.minMembers}+ members`],
      markers: placed.get(r.code),
    }));
    if (placed.has("")) rungs.push({ code: "", label: "Uncategorised", criteria: ["Below every category"], markers: placed.get("") });
  } else if (kind === "zone") {
    const here = live?.zone?.placement.rung?.code;
    rungs = rules.zone.map((r) => ({
      code: r.code,
      label: r.label,
      criteria:
        r.minAmount > 0
          ? [`From ${usd(r.minAmount)} a year`, `${r.minChapters}+ chapters`, `${r.minMembers}+ members`]
          : ["Below every other category"],
      note: r.note,
      markers: here === r.code ? [ctx.zoneName] : undefined,
      highlight: here === r.code,
    }));
  } else if (kind === "member") {
    const mine = live?.me?.tier.code;
    const rank = rules.member.rankTier;
    const amountRungs = rules.member.rungs.map((r, i, all) => ({
      code: r.code,
      label: r.label,
      color: r.color,
      criteria: [r.minAmount > 0 ? `From ${usd(r.minAmount)} a year` : i > 0 ? `Below ${usd(all[i - 1].minAmount)} a year` : "Any giving"],
      markers: mine === r.code ? ["You"] : undefined,
      highlight: mine === r.code,
    }));
    rungs = rank
      ? [
          {
            code: rank.code,
            label: rank.label,
            color: rank.color,
            criteria: [`Top ${rank.topN} partners for ${rank.years} consecutive years`],
            markers: mine === rank.code ? ["You"] : undefined,
            highlight: mine === rank.code,
          },
          ...amountRungs,
        ]
      : amountRungs;
  } else {
    rungs = rules.governorship.map((r) => ({
      code: r.title,
      label: r.title,
      alias: r.alias,
      criteria: [`Gives at least ${usd(r.minAmount)} a year`],
      note: r.requirements.join(" · "),
    }));
  }

  return <TierLadder rungs={rungs} markerLabel="Currently here" />;
}

export function BlockRenderer({ blocks, sectionId, ctx }: { blocks: Block[]; sectionId: string; ctx: HandbookRenderContext }) {
  return (
    <div className="space-y-4 text-[15px]">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={i} className="leading-relaxed">
                {block.text}
              </p>
            );
          case "list":
            return <ListView key={i} items={block.items} ordered={block.ordered} />;
          case "callout": {
            const Icon = block.tone === "warning" ? TriangleAlert : Info;
            return (
              <div
                key={i}
                className={cn(
                  "flex gap-3 rounded-xl border p-4 text-sm",
                  block.tone === "warning" ? "border-amber-500/40 bg-amber-500/10" : "border-primary/20 bg-primary/5"
                )}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", block.tone === "warning" ? "text-amber-600" : "text-primary")} />
                <div className="space-y-1 leading-relaxed">
                  {block.title && <p className="font-medium">{block.title}</p>}
                  <p>{block.text}</p>
                </div>
              </div>
            );
          }
          case "steps":
            return <ProcedureStepper key={i} steps={block.steps} />;
          case "flow":
            return <FlowDiagram key={i} title={block.title} stages={block.stages} />;
          case "meetings":
            return <MeetingCards key={i} meetings={block.meetings} ctx={ctx} />;
          case "checklist":
            return (
              <ul key={i} className="divide-y rounded-xl border">
                {block.items.map((item) => {
                  const feature = item.portal ? PORTAL_FEATURES[item.portal] : null;
                  return (
                    <li key={item.text} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                      <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", feature ? "text-primary" : "text-muted-foreground/50")} />
                      <span className="flex-1 leading-snug">{item.text}</span>
                      {feature &&
                        (ctx.isLeader ? (
                          <Link href={feature.href(ctx)} className="shrink-0 text-xs font-medium text-primary hover:underline">
                            {feature.label} →
                          </Link>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">In the portal</span>
                        ))}
                    </li>
                  );
                })}
              </ul>
            );
          case "orgChart":
            return <OrgChart key={i} roles={ctx.roles} holders={ctx.live?.holders ?? null} initialRoleId={ctx.initialRoleId} />;
          case "ladder":
            return <Ladder key={i} kind={block.ladder} ctx={ctx} />;
          case "live": {
            const live = ctx.live;
            if (!live) return null;
            switch (block.widget) {
              case "chapterStandings":
                return <ChapterStandings key={i} live={live} sectionId={sectionId} fmt={ctx} />;
              case "zoneStanding":
                return <ZoneStanding key={i} live={live} zoneName={ctx.zoneName} sectionId={sectionId} fmt={ctx} />;
              case "myTier":
                return <MyTier key={i} live={live} fmt={ctx} />;
              case "tierDistribution":
                return <TierDistribution key={i} live={live} sectionId={sectionId} fmt={ctx} />;
            }
          }
        }
      })}
    </div>
  );
}

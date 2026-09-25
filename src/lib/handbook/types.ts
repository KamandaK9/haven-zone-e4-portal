import type { LucideIcon } from "lucide-react";
import type { Portfolio, Position } from "@/lib/access";

// A tenant's handbook (operating manual, SOP, policy book) as typed data.
// Stratum renders it — pages, org chart, steppers, category ladders — and
// joins the category rules to live giving/membership data. The words and
// default thresholds belong to the tenant (src/tenant/), never core.

export type ListItem = string | { text: string; items: ListItem[] };

export type ProcedureStep = {
  title: string;
  detail?: string;
  // Who acts at this step ("CE Church Pastor", "Zonal Director").
  actor?: string;
  // Time limit, verbatim from the source ("Within 2 weeks").
  deadline?: string;
};

export type Meeting = {
  name: string;
  cadence: string;
  attendance: string;
  // Extra constraint worth surfacing as a chip ("By 30 June").
  deadline?: string;
  // Event series slug (TenantConfig.eventSeries) this meeting is published under.
  seriesSlug?: string;
  points: string[];
};

// One stage of a left-to-right flow; a stage with several nodes is a fork.
export type FlowStage = {
  // Label on the arrow leading into this stage.
  via?: string;
  nodes: { label: string; detail?: string }[];
};

// Portal pages that satisfy a record-keeping duty, keyed so core owns the hrefs.
export type PortalFeature =
  | "members"
  | "cells"
  | "ledger"
  | "reports"
  | "calendar"
  | "training"
  | "minutes"
  | "correspondence"
  | "bankAdvices"
  | "cheques";

export type LadderKind = "zone" | "chapter" | "member" | "governorship";

export type LiveWidget = "chapterStandings" | "zoneStanding" | "tierDistribution" | "myTier";

export type Block =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: ListItem[]; ordered?: boolean }
  | { type: "callout"; tone: "info" | "warning"; title?: string; text: string }
  | { type: "steps"; steps: ProcedureStep[] }
  | { type: "flow"; title?: string; stages: FlowStage[] }
  | { type: "meetings"; meetings: Meeting[] }
  | { type: "checklist"; items: { text: string; portal?: PortalFeature }[] }
  | { type: "orgChart" }
  | { type: "ladder"; ladder: LadderKind }
  | { type: "live"; widget: LiveWidget };

export type HandbookSection = {
  // Anchor id, unique within the page.
  id: string;
  title: string;
  // Page range in the source document, for anyone cross-checking the original.
  sourcePages?: string;
  blocks: Block[];
};

export type HandbookPage = {
  slug: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  sections: HandbookSection[];
};

// An office in the organisation chart.
export type Role = {
  id: string;
  title: string;
  // Band the office sits in, top to bottom.
  level: string;
  parentId: string | null;
  summary: string;
  responsibilities: string[];
  // Reports to / Appointed by / Tenure / ... — shown as a fact list.
  facts: { label: string; value: string }[];
  // Portal position this office maps to, so live holders can be listed.
  position?: Position;
  portfolio?: Portfolio;
};

// ─── Category rules (editable per org; defaults come from the tenant) ─────

// Rungs are ordered best → worst. A rung is met when every minimum on it is
// met; an entity's category is the first (highest) rung it meets.
export type ChapterRung = { code: string; label: string; minAmount: number; minMembers: number };
export type ZoneRung = ChapterRung & { minChapters: number; note?: string };
export type MemberRung = { code: string; label: string; minAmount: number; color: string };
export type GovernorshipRung = { title: string; alias?: string; minAmount: number; requirements: string[] };

export type HandbookRules = {
  // Label for whatever the source calls the giving year ("ministry year").
  yearLabel: string;
  zone: ZoneRung[];
  chapter: ChapterRung[];
  member: {
    rungs: MemberRung[];
    // Top-of-ladder tier that's earned by rank, not amount (e.g. "top 3
    // partners for 3 consecutive years"); null when there isn't one.
    rankTier: { code: string; label: string; color: string; topN: number; years: number } | null;
  };
  governorship: GovernorshipRung[];
};

export type HandbookContent = {
  title: string;
  // Shown in page footers: "Source: ...".
  source: string;
  // Short name for page references ("SOP p. 12").
  sourceShort: string;
  intro: {
    about: string[];
    vision: string;
    mission: string[];
    objectives: string[];
  };
  roles: Role[];
  pages: HandbookPage[];
  rules: HandbookRules;
};

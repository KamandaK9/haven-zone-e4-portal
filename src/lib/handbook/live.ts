import "server-only";
import { can, type CurrentProfile } from "@/lib/data/get-dataset";
import { getMembersByChurch, memberFullName, type Dataset } from "@/lib/data/analytics";
import {
  categoriseChapter,
  categoriseZone,
  memberTierGap,
  memberTierIndex,
  rankTierIds,
  totalsByYear,
  type Placement,
} from "./categorise";
import type { ChapterRung, HandbookRules, MemberRung, Role, ZoneRung } from "./types";

// Everything the handbook shows from real data, already cut down to what the
// viewer may see. Each part is null when they may not see it (or it doesn't
// apply), and the matching widget simply doesn't render.
export type HandbookLive = {
  year: number;
  years: number[];
  currentYear: number;
  chapters: { id: string; name: string; amount: number; members: number; placement: Placement<ChapterRung> }[] | null;
  zone: { amount: number; members: number; chapters: number; placement: Placement<ZoneRung> } | null;
  distribution: { tier: MemberRung; count: number }[] | null;
  // Whether the rank tier (e.g. Platinum) could be worked out — it needs the
  // whole zone's individual giving.
  rankTierComputed: boolean;
  // The viewer's own tier for `year`, plus how this year is going — the gap
  // is only actionable for the year still in progress.
  me: {
    tier: MemberRung;
    amount: number;
    rankTier: boolean;
    thisYear: { amount: number; gap: { next: MemberRung; amount: number } | null };
  } | null;
  // Office id → "Name · Chapter" for everyone holding it.
  holders: Record<string, string[]> | null;
};

// The rank tier (e.g. Platinum) prepended as a pseudo-rung so every tier can
// be listed and counted uniformly.
function allTiers(rules: HandbookRules): MemberRung[] {
  const rank = rules.member.rankTier;
  return rank ? [{ code: rank.code, label: rank.label, minAmount: Infinity, color: rank.color }, ...rules.member.rungs] : rules.member.rungs;
}

export function buildHandbookLive(
  profile: CurrentProfile,
  ds: Dataset,
  rules: HandbookRules,
  roles: readonly Role[],
  requestedYear: number | null
): HandbookLive {
  const currentYear = new Date().getFullYear();
  const chapters = ds.churches.filter((c) => !c.isOffice);

  // Years with any giving the viewer can see, always including this one.
  const yearSet = new Set<number>([currentYear]);
  for (const g of ds.giving) yearSet.add(Number(g.month.slice(0, 4)));
  for (const m of ds.members) for (const g of m.giving) yearSet.add(Number(g.month.slice(0, 4)));
  const years = [...yearSet].filter(Number.isFinite).sort((a, b) => b - a);
  // Categories are set from the concluding year, so default to the latest
  // complete year that has data.
  const year = requestedYear && years.includes(requestedYear) ? requestedYear : (years.find((y) => y < currentYear) ?? currentYear);

  const canTotals = can(profile, "view_giving_totals");
  const byChurch = new Map<string, Map<number, number>>();
  if (canTotals) {
    const rowsByChurch = new Map<string, typeof ds.giving>();
    for (const g of ds.giving) rowsByChurch.set(g.churchId, [...(rowsByChurch.get(g.churchId) ?? []), g]);
    for (const [churchId, rows] of rowsByChurch) byChurch.set(churchId, totalsByYear(rows));
  }

  const chapterRows = canTotals
    ? chapters
        .map((c) => {
          const amount = byChurch.get(c.id)?.get(year) ?? 0;
          const members = getMembersByChurch(ds, c.id).length;
          return { id: c.id, name: c.name, amount, members, placement: categoriseChapter(rules, { amount, members }) };
        })
        .sort((a, b) => b.amount - a.amount)
    : null;

  const zone =
    canTotals && profile.scope === "zone"
      ? (() => {
          let amount = 0;
          for (const totals of byChurch.values()) amount += totals.get(year) ?? 0;
          const standing = { amount, members: ds.members.length, chapters: chapters.length };
          return { ...standing, placement: categoriseZone(rules, standing) };
        })()
      : null;

  // Individual tiers.
  const tiers = allTiers(rules);
  const rank = rules.member.rankTier;
  const histories = ds.members.map((m) => ({ id: m.id, byYear: totalsByYear(m.giving) }));
  // A rank tier compares against everyone, so it's only computed when the
  // viewer can see the whole zone's individual giving.
  const fullPopulation = can(profile, "view_giving_individual") && profile.scope === "zone";
  const rankIds = rank && fullPopulation ? rankTierIds(histories, year, rank.topN, rank.years) : new Set<string>();
  const tierOf = (h: (typeof histories)[number]): MemberRung =>
    rankIds.has(h.id) ? tiers[0] : rules.member.rungs[memberTierIndex(rules.member.rungs, h.byYear, year)];

  const distribution = can(profile, "view_giving_individual")
    ? tiers.map((tier) => ({ tier, count: histories.filter((h) => tierOf(h) === tier).length }))
    : null;

  const myMemberId = profile.linkedMemberId ?? ds.members.find((m) => m.profileId === profile.userId)?.id ?? null;
  const mine = myMemberId ? histories.find((h) => h.id === myMemberId) : undefined;
  const me = mine
    ? {
        tier: tierOf(mine),
        amount: mine.byYear.get(year) ?? 0,
        rankTier: rankIds.has(mine.id),
        thisYear: {
          amount: mine.byYear.get(currentYear) ?? 0,
          gap: rankIds.has(mine.id) ? null : memberTierGap(rules.member.rungs, mine.byYear, currentYear),
        },
      }
    : null;

  let holders: Record<string, string[]> | null = null;
  if (can(profile, "view_members")) {
    holders = {};
    const churchName = new Map(ds.churches.map((c) => [c.id, c]));
    for (const role of roles) {
      if (!role.position) continue;
      holders[role.id] = ds.members
        .filter((m) => m.position === role.position && (!role.portfolio || m.portfolio === role.portfolio))
        .map((m) => {
          const church = churchName.get(m.churchId);
          return church && !church.isOffice ? `${memberFullName(m)} · ${church.name}` : memberFullName(m);
        })
        .sort();
    }
  }

  return { year, years, currentYear, chapters: chapterRows, zone, distribution, rankTierComputed: !!rank && fullPopulation, me, holders };
}

import { ACTIVITY, CHURCHES, COUNTRIES, EVENTS, LAST_12_MONTHS, MEMBERS } from "./seed";
import type { Church, Country, Member } from "./types";

export function getCountry(id: string): Country | undefined {
  return COUNTRIES.find((c) => c.id === id);
}

export function getChurch(id: string): Church | undefined {
  return CHURCHES.find((c) => c.id === id);
}

export function getMember(id: string): Member | undefined {
  return MEMBERS.find((m) => m.id === id);
}

export function getChurchesByCountry(countryId: string): Church[] {
  return CHURCHES.filter((c) => c.countryId === countryId);
}

export function getMembersByCountry(countryId: string): Member[] {
  return MEMBERS.filter((m) => m.countryId === countryId);
}

export function getMembersByChurch(churchId: string): Member[] {
  return MEMBERS.filter((m) => m.churchId === churchId);
}

export function memberFullName(m: Member): string {
  return `${m.firstName} ${m.lastName}`;
}

export function memberTotalGiving(m: Member): number {
  return m.giving.reduce((sum, g) => sum + g.amount, 0);
}

export function memberTenureYears(m: Member): number {
  const ms = new Date(2026, 8, 16).getTime() - new Date(m.joinDate).getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

const NOW = new Date(2026, 8, 16);
const THIS_MONTH = "2026-09";

export function getZoneStats() {
  const totalMembers = MEMBERS.length;
  const totalChurches = CHURCHES.length;
  const totalCountries = COUNTRIES.length;
  const newThisMonth = MEMBERS.filter((m) => m.joinDate.slice(0, 7) === THIS_MONTH).length;

  // Trailing-quarter comparison reads more meaningfully than a single noisy
  // month-over-month join count on a zone this size.
  const quarterAgoMonth = LAST_12_MONTHS[LAST_12_MONTHS.length - 4] ?? LAST_12_MONTHS[0];
  const membersAsOfQuarterAgo = MEMBERS.filter((m) => m.joinDate.slice(0, 7) <= quarterAgoMonth).length;
  const growthPct =
    membersAsOfQuarterAgo === 0
      ? 100
      : Math.round(((totalMembers - membersAsOfQuarterAgo) / membersAsOfQuarterAgo) * 100);

  const totalGiving = MEMBERS.reduce((sum, m) => sum + memberTotalGiving(m), 0);
  return { totalMembers, totalChurches, totalCountries, newThisMonth, growthPct, totalGiving };
}

export function getCountryStats(countryId: string) {
  const members = getMembersByCountry(countryId);
  const churches = getChurchesByCountry(countryId);
  const totalGiving = members.reduce((sum, m) => sum + memberTotalGiving(m), 0);
  const avgTenure =
    members.length === 0
      ? 0
      : members.reduce((sum, m) => sum + memberTenureYears(m), 0) / members.length;
  return {
    memberCount: members.length,
    churchCount: churches.length,
    totalGiving,
    avgTenure,
  };
}

export function getChurchStats(churchId: string) {
  const members = getMembersByChurch(churchId);
  const totalGiving = members.reduce((sum, m) => sum + memberTotalGiving(m), 0);
  const avgTenure =
    members.length === 0
      ? 0
      : members.reduce((sum, m) => sum + memberTenureYears(m), 0) / members.length;
  return { memberCount: members.length, totalGiving, avgTenure };
}

export function getTopGivers(limit = 10) {
  return [...MEMBERS]
    .map((m) => ({ member: m, total: memberTotalGiving(m) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function getGivingTrendZone() {
  return LAST_12_MONTHS.map((month) => ({
    month,
    amount: MEMBERS.reduce((sum, m) => {
      const point = m.giving.find((g) => g.month === month);
      return sum + (point?.amount ?? 0);
    }, 0),
  }));
}

export function getGivingByCountry() {
  return COUNTRIES.map((c) => ({
    countryId: c.id,
    name: c.name,
    amount: getMembersByCountry(c.id).reduce((sum, m) => sum + memberTotalGiving(m), 0),
  })).sort((a, b) => b.amount - a.amount);
}

export function getGivingByChurch(countryId?: string) {
  const churches = countryId ? getChurchesByCountry(countryId) : CHURCHES;
  return churches
    .map((c) => ({
      churchId: c.id,
      name: c.name,
      amount: getMembersByChurch(c.id).reduce((sum, m) => sum + memberTotalGiving(m), 0),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function getTenureDistribution(members: Member[] = MEMBERS) {
  const buckets = { "< 1 year": 0, "1–3 years": 0, "3–5 years": 0, "5+ years": 0 };
  for (const m of members) {
    const years = memberTenureYears(m);
    if (years < 1) buckets["< 1 year"]++;
    else if (years < 3) buckets["1–3 years"]++;
    else if (years < 5) buckets["3–5 years"]++;
    else buckets["5+ years"]++;
  }
  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

export function getMembershipGrowth() {
  // Cumulative membership count sampled at each of the last 12 months.
  return LAST_12_MONTHS.map((month) => {
    const cumulative = MEMBERS.filter((m) => m.joinDate.slice(0, 7) <= month).length;
    const newInMonth = MEMBERS.filter((m) => m.joinDate.slice(0, 7) === month).length;
    return { month, cumulative, new: newInMonth };
  });
}

export function getChurchHealth() {
  const recentMonths = new Set(LAST_12_MONTHS.slice(-3));
  const priorMonths = new Set(LAST_12_MONTHS.slice(-6, -3));

  return CHURCHES.map((church) => {
    const members = getMembersByChurch(church.id);
    const recentJoins = members.filter((m) => memberTenureYears(m) < 0.5).length;

    const sumGivingIn = (months: Set<string>) =>
      members.reduce(
        (sum, m) => sum + m.giving.filter((g) => months.has(g.month)).reduce((s, g) => s + g.amount, 0),
        0
      );
    const recentGiving = sumGivingIn(recentMonths);
    const priorGiving = sumGivingIn(priorMonths);
    const momentum = priorGiving === 0 ? (recentGiving > 0 ? 1 : 0) : (recentGiving - priorGiving) / priorGiving;

    let status: "Growing" | "Flat" | "Needs Attention" = "Flat";
    if (momentum > 0.08) status = "Growing";
    else if (momentum < -0.15) status = "Needs Attention";

    return {
      church,
      memberCount: members.length,
      recentJoins,
      status,
    };
  });
}

export function getRecentActivity(limit = 8) {
  return [...ACTIVITY]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function getUpcomingEvents(limit?: number) {
  const sorted = [...EVENTS].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((e) => e.date >= "2026-09-16");
  return limit ? upcoming.slice(0, limit) : upcoming;
}

export function timeAgo(iso: string): string {
  const diffMs = NOW.getTime() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

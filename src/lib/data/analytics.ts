import type {
  ActivityItem,
  CalendarEvent,
  Church,
  Country,
  GivingAggregate,
  Member,
  SubZone,
  TrainingProgram,
} from "./types";
import type { GivingFilter } from "@/lib/giving";

export type Dataset = {
  members: Member[];
  churches: Church[];
  countries: Country[];
  activity: ActivityItem[];
  events: CalendarEvent[];
  trainingPrograms: TrainingProgram[];
  subZones: SubZone[];
  giving: GivingAggregate[];
  // False when the viewer may see totals but not any one person's giving.
  individualGiving: boolean;
};

export function getLast12Months(now = new Date()): string[] {
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function todayISODate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getCountry(ds: Dataset, id: string): Country | undefined {
  return ds.countries.find((c) => c.id === id);
}

export function getChurch(ds: Dataset, id: string): Church | undefined {
  return ds.churches.find((c) => c.id === id);
}

export function getMember(ds: Dataset, id: string): Member | undefined {
  return ds.members.find((m) => m.id === id);
}

export function getChurchesByCountry(ds: Dataset, countryId: string): Church[] {
  return ds.churches.filter((c) => c.countryId === countryId);
}

export function getMembersByCountry(ds: Dataset, countryId: string): Member[] {
  return ds.members.filter((m) => m.countryId === countryId);
}

export function getMembersByChurch(ds: Dataset, churchId: string): Member[] {
  return ds.members.filter((m) => m.churchId === churchId);
}

export function memberFullName(m: Member): string {
  return `${m.firstName} ${m.lastName}`;
}

export function memberTotalGiving(m: Member, filter: GivingFilter = "all"): number {
  return m.giving.reduce((sum, g) => (filter === "all" || g.category === filter ? sum + g.amount : sum), 0);
}

export function getTotalGiving(ds: Dataset, filter: GivingFilter = "all"): number {
  return sumGiving(ds.giving, filter);
}

// Undefined when the join date is unknown (rosters rarely carry one).
export function memberTenureYears(m: Member, now = new Date()): number | undefined {
  if (!m.joinDate) return undefined;
  const ms = now.getTime() - new Date(m.joinDate).getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

export function formatTenure(years: number | undefined): string {
  if (years === undefined) return "—";
  return years < 0.1 ? "New" : `${years.toFixed(1)} yrs`;
}

function averageTenure(members: Member[], now: Date): number {
  const known = members.map((m) => memberTenureYears(m, now)).filter((y): y is number => y !== undefined);
  return known.length === 0 ? 0 : known.reduce((sum, y) => sum + y, 0) / known.length;
}

function givingMatches(g: GivingAggregate, filter: GivingFilter): boolean {
  return filter === "all" || g.category === filter;
}

function sumGiving(rows: GivingAggregate[], filter: GivingFilter = "all"): number {
  return rows.reduce((sum, g) => (givingMatches(g, filter) ? sum + g.amount : sum), 0);
}

export function memberTrainingPoints(m: Member): number {
  return m.trainings.filter((t) => t.status === "completed").reduce((sum, t) => sum + t.points, 0);
}

export function getTrainingLeaderboard(ds: Dataset, limit = 10) {
  return [...ds.members]
    .map((m) => ({ member: m, points: memberTrainingPoints(m) }))
    .filter((row) => row.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}

export function getZoneStats(ds: Dataset, now = new Date()) {
  const totalMembers = ds.members.length;
  const totalChurches = ds.churches.filter((c) => !c.isOffice).length;
  const totalCountries = ds.countries.length;
  const thisMonth = getLast12Months(now).at(-1)!;
  const newThisMonth = ds.members.filter((m) => m.joinDate?.slice(0, 7) === thisMonth).length;

  // Trailing-quarter comparison reads more meaningfully than a single noisy
  // month-over-month join count on a zone this size.
  const months = getLast12Months(now);
  const quarterAgoMonth = months[months.length - 4] ?? months[0];
  // A member with no recorded join date is treated as already there rather
  // than as a new joiner.
  const membersAsOfQuarterAgo = ds.members.filter((m) => !m.joinDate || m.joinDate.slice(0, 7) <= quarterAgoMonth).length;
  const growthPct =
    membersAsOfQuarterAgo === 0
      ? totalMembers > 0
        ? 100
        : 0
      : Math.round(((totalMembers - membersAsOfQuarterAgo) / membersAsOfQuarterAgo) * 100);

  const totalGiving = getTotalGiving(ds);
  return { totalMembers, totalChurches, totalCountries, newThisMonth, growthPct, totalGiving };
}

export function getCountryStats(ds: Dataset, countryId: string, now = new Date()) {
  const members = getMembersByCountry(ds, countryId);
  const churches = getChurchesByCountry(ds, countryId);
  const churchIds = new Set(churches.map((c) => c.id));
  const totalGiving = sumGiving(ds.giving.filter((g) => churchIds.has(g.churchId)));
  const avgTenure = averageTenure(members, now);
  return {
    memberCount: members.length,
    churchCount: churches.filter((c) => !c.isOffice).length,
    totalGiving,
    avgTenure,
  };
}

export function getChurchStats(ds: Dataset, churchId: string, filter: GivingFilter = "all", now = new Date()) {
  const members = getMembersByChurch(ds, churchId);
  const totalGiving = sumGiving(
    ds.giving.filter((g) => g.churchId === churchId),
    filter
  );
  const avgTenure = averageTenure(members, now);
  return { memberCount: members.length, totalGiving, avgTenure };
}

export function getTopGivers(ds: Dataset, limit = 10, filter: GivingFilter = "all") {
  return ds.members
    .map((m) => ({ member: m, total: memberTotalGiving(m, filter) }))
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export function getGivingTrendZone(ds: Dataset, filter: GivingFilter = "all", now = new Date()) {
  return getLast12Months(now).map((month) => ({
    month,
    amount: sumGiving(
      ds.giving.filter((g) => g.month === month),
      filter
    ),
  }));
}

export function getGivingByCountry(ds: Dataset, filter: GivingFilter = "all") {
  const countryByChurch = new Map(ds.churches.map((c) => [c.id, c.countryId]));
  return ds.countries
    .map((c) => ({
      countryId: c.id,
      name: c.name,
      amount: sumGiving(
        ds.giving.filter((g) => countryByChurch.get(g.churchId) === c.id),
        filter
      ),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function getGivingByChurch(ds: Dataset, countryId?: string, filter: GivingFilter = "all") {
  const churches = (countryId ? getChurchesByCountry(ds, countryId) : ds.churches).filter((c) => !c.isOffice);
  return churches
    .map((c) => ({
      churchId: c.id,
      name: c.name,
      amount: sumGiving(
        ds.giving.filter((g) => g.churchId === c.id),
        filter
      ),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function getTenureDistribution(members: Member[], now = new Date()) {
  const buckets = { "< 1 year": 0, "1–3 years": 0, "3–5 years": 0, "5+ years": 0 };
  for (const m of members) {
    const years = memberTenureYears(m, now);
    if (years === undefined) continue;
    if (years < 1) buckets["< 1 year"]++;
    else if (years < 3) buckets["1–3 years"]++;
    else if (years < 5) buckets["3–5 years"]++;
    else buckets["5+ years"]++;
  }
  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

export function getMembershipGrowth(ds: Dataset, now = new Date()) {
  // Cumulative membership count sampled at each of the last 12 months.
  return getLast12Months(now).map((month) => {
    const cumulative = ds.members.filter((m) => !m.joinDate || m.joinDate.slice(0, 7) <= month).length;
    const newInMonth = ds.members.filter((m) => m.joinDate?.slice(0, 7) === month).length;
    return { month, cumulative, new: newInMonth };
  });
}

export function getChurchHealth(ds: Dataset, now = new Date()) {
  const months = getLast12Months(now);
  const recentMonths = new Set(months.slice(-3));
  const priorMonths = new Set(months.slice(-6, -3));

  return ds.churches.filter((c) => !c.isOffice).map((church) => {
    const members = getMembersByChurch(ds, church.id);
    const recentJoins = members.filter((m) => (memberTenureYears(m, now) ?? Infinity) < 0.5).length;

    const churchGiving = ds.giving.filter((g) => g.churchId === church.id);
    const sumGivingIn = (monthSet: Set<string>) => sumGiving(churchGiving.filter((g) => monthSet.has(g.month)));
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

export function getRecentActivity(ds: Dataset, limit = 8) {
  return [...ds.activity]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export function getUpcomingEvents(ds: Dataset, limit?: number, now = new Date()) {
  const today = todayISODate(now);
  const sorted = [...ds.events].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((e) => e.date >= today);
  return limit ? upcoming.slice(0, limit) : upcoming;
}

export function timeAgo(iso: string, now = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

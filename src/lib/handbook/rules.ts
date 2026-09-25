import type { HandbookRules } from "./types";

// A zone's own thresholds, stored as numbers keyed by rung code (or title,
// for leadership rungs) on top of the tenant's defaults. Keying by code
// rather than position means a tenant can reorder or add rungs later without
// an old override landing on the wrong one; codes that no longer exist are
// ignored. Labels, colours and wording always come from the tenant.
export type RuleOverrides = {
  zone?: Record<string, { minAmount?: number; minChapters?: number; minMembers?: number }>;
  chapter?: Record<string, { minAmount?: number; minMembers?: number }>;
  member?: Record<string, { minAmount?: number }>;
  governorship?: Record<string, { minAmount?: number }>;
};

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function applyRuleOverrides(defaults: HandbookRules, overrides: RuleOverrides | null | undefined): HandbookRules {
  if (!overrides) return defaults;
  return {
    ...defaults,
    zone: defaults.zone.map((r) => {
      const o = overrides.zone?.[r.code];
      return o
        ? { ...r, minAmount: num(o.minAmount, r.minAmount), minChapters: num(o.minChapters, r.minChapters), minMembers: num(o.minMembers, r.minMembers) }
        : r;
    }),
    chapter: defaults.chapter.map((r) => {
      const o = overrides.chapter?.[r.code];
      return o ? { ...r, minAmount: num(o.minAmount, r.minAmount), minMembers: num(o.minMembers, r.minMembers) } : r;
    }),
    member: {
      ...defaults.member,
      rungs: defaults.member.rungs.map((r) => ({ ...r, minAmount: num(overrides.member?.[r.code]?.minAmount, r.minAmount) })),
    },
    governorship: defaults.governorship.map((r) => ({ ...r, minAmount: num(overrides.governorship?.[r.title]?.minAmount, r.minAmount) })),
  };
}

// The overrides that turn `defaults` into `edited` — only values that differ,
// so an untouched rung keeps following the tenant's defaults. Null when
// nothing differs.
export function diffRuleOverrides(defaults: HandbookRules, edited: HandbookRules): RuleOverrides | null {
  const out: RuleOverrides = {};
  const pick = <T extends Record<string, number>>(a: T, b: T) => {
    const changed: Partial<T> = {};
    for (const k of Object.keys(a) as (keyof T)[]) if (a[k] !== b[k]) changed[k] = b[k];
    return Object.keys(changed).length ? changed : null;
  };

  defaults.zone.forEach((r, i) => {
    const e = edited.zone[i];
    const c = e && pick(
      { minAmount: r.minAmount, minChapters: r.minChapters, minMembers: r.minMembers },
      { minAmount: e.minAmount, minChapters: e.minChapters, minMembers: e.minMembers }
    );
    if (c) (out.zone ??= {})[r.code] = c;
  });
  defaults.chapter.forEach((r, i) => {
    const e = edited.chapter[i];
    const c = e && pick({ minAmount: r.minAmount, minMembers: r.minMembers }, { minAmount: e.minAmount, minMembers: e.minMembers });
    if (c) (out.chapter ??= {})[r.code] = c;
  });
  defaults.member.rungs.forEach((r, i) => {
    const e = edited.member.rungs[i];
    if (e && e.minAmount !== r.minAmount) (out.member ??= {})[r.code] = { minAmount: e.minAmount };
  });
  defaults.governorship.forEach((r, i) => {
    const e = edited.governorship[i];
    if (e && e.minAmount !== r.minAmount) (out.governorship ??= {})[r.title] = { minAmount: e.minAmount };
  });
  return Object.keys(out).length ? out : null;
}

// Every threshold a whole, non-negative number, and each ladder ordered: a
// higher rung needs strictly more money, and never fewer members/chapters.
// Returns the first problem as a sentence, or null when the rules are sound.
export function validateRules(rules: HandbookRules): string | null {
  type Row = { label: string; minAmount: number; counts: [string, number][] };
  const ladders: [string, Row[]][] = [
    ["Zone", rules.zone.map((r) => ({ label: r.label, minAmount: r.minAmount, counts: [["chapters", r.minChapters], ["members", r.minMembers]] }))],
    ["Chapter", rules.chapter.map((r) => ({ label: r.label, minAmount: r.minAmount, counts: [["members", r.minMembers]] }))],
    ["Membership card", rules.member.rungs.map((r) => ({ label: r.label, minAmount: r.minAmount, counts: [] }))],
    ["Chapter leadership", rules.governorship.map((r) => ({ label: r.title, minAmount: r.minAmount, counts: [] }))],
  ];

  for (const [ladder, rows] of ladders) {
    for (const row of rows) {
      for (const [what, v] of [["amount", row.minAmount], ...row.counts] as [string, number][]) {
        if (!Number.isInteger(v) || v < 0) return `${ladder} — ${row.label}: the minimum ${what} must be a whole number of 0 or more.`;
      }
    }
    for (let i = 1; i < rows.length; i++) {
      const [above, below] = [rows[i - 1], rows[i]];
      if (above.minAmount <= below.minAmount) {
        return `${ladder} — ${above.label} must need more giving than ${below.label}.`;
      }
      for (let c = 0; c < above.counts.length; c++) {
        if (above.counts[c][1] < below.counts[c][1]) {
          return `${ladder} — ${above.label} can't need fewer ${above.counts[c][0]} than ${below.label}.`;
        }
      }
    }
  }
  return null;
}

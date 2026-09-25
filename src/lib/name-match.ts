// Fuzzy person-matching shared by the roster importer (dedupe across
// summary/sub-zone sheets) and the "Find duplicates" tool (dedupe already-
// imported members). Hand-kept spreadsheets are full of small typos
// ("Taurai"/"Taurayi", "Engie"/"Engina"), so this tolerates a couple of
// character edits per name part rather than requiring an exact match.

// Order-insensitive, letters only — "Moyo Blessing" == "Blessing MOYO".
export function nameKey(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// Same name part allowing for typos. Short names must match exactly so
// "Tino" and "Tina" stay different people.
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const longest = Math.max(a.length, b.length);
  const allowed = longest >= 6 ? 2 : longest >= 5 ? 1 : 0;
  return editDistance(a, b) <= allowed;
}

// A shared email or phone number alone isn't proof of the same person —
// spouses often share one. So it only counts when the names also agree: every
// name part of the shorter name must match a part of the other (so "Blessing
// Manyeza" matches "Blessing Manyeza" but not her husband "Tendai Manyeza").
export function namesAgree(a: { firstName: string; lastName: string }, b: { firstName: string; lastName: string }): boolean {
  const tokens = (p: { firstName: string; lastName: string }) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const ta = tokens(a);
  const tb = tokens(b);
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return short.length > 0 && short.every((t) => long.some((u) => tokensMatch(t, u)));
}

export function normalizePhone(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  // Compare by the local subscriber number — country-code/leading-zero
  // formatting is inconsistent across sources for the same real number.
  return digits.length >= 9 ? digits.slice(-9) : digits || undefined;
}

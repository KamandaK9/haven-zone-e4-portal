// Matches a cell name typed into a spreadsheet to one of the chapter's
// existing cells. Hand-kept sheets spell the same cell many ways
// ("Kings&Pearls", "King & Pearls", "Honerable Kings"), so names are compared
// on a normalised key and then, failing an exact hit, by a small edit
// distance — the closest cell, and only when no other is just as close.

export function cellKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\bcel{1,2}\b/g, "") // the word "cell" (or "cel") anywhere: "Swan Cell 3" = "Swan3"
    .replace(/[^a-z0-9]/g, "");
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function matchCell<T extends { id: string; name: string }>(name: string, cells: T[]): T | undefined {
  const key = cellKey(name);
  if (!key) return undefined;
  const exact = cells.find((c) => cellKey(c.name) === key);
  if (exact) return exact;
  // Short keys ("y", "swan") are too easy to confuse, so they must match exactly.
  if (key.length < 5) return undefined;
  const maxDistance = key.length < 8 ? 1 : 2;
  // Numbers are never fuzzed: "Swan 2" is a different cell from "Swan".
  const digits = (k: string) => k.replace(/\D/g, "");
  const scored = cells
    .filter((c) => digits(cellKey(c.name)) === digits(key))
    .map((c) => ({ c, d: editDistance(cellKey(c.name), key) }))
    .filter((s) => s.d <= maxDistance)
    .sort((a, b) => a.d - b.d);
  // The closest cell wins, but only if no other is just as close.
  if (scored.length === 0 || (scored.length > 1 && scored[1].d === scored[0].d)) return undefined;
  return scored[0].c;
}

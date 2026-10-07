import { tenant } from "@/tenant";
import { matchCell } from "./match-cell";

// Groups the cell names found in a member sheet into the cells they most
// likely mean: "Kings&Pearls", "King & Pearls" and "KINGS & PEARLS" become one
// suggested cell, named after its most-used spelling. Used when cells are
// created from an import (setup), where there are no existing cells to match.
export type CellCluster = {
  name: string; // the suggested cell name (most-used spelling)
  variants: string[]; // every spelling in the sheet, including `name`
  count: number; // members across all spellings
  // A guess at whether this is a real cell rather than a ministry or an
  // age group ("Youth Church") or a placeholder ("Not yet") — the admin
  // confirms it.
  likelyCell: boolean;
};

const NOT_CELL_WORDS = ["church", "not yet", "no yet", "none", "n/a", "unknown", "tbc", "tba"];

function looksLikeCell(name: string): boolean {
  const n = name.toLowerCase();
  if (n.replace(/[^a-z0-9]/g, "").length < 3) return false;
  if (NOT_CELL_WORDS.some((w) => n.includes(w))) return false;
  const groups = (tenant.ageGroups ?? []).flatMap((g) => [g.key, g.label].map((s) => s.toLowerCase().replace(/s$/, "")));
  return !groups.some((g) => n.split(/[^a-z]+/).some((word) => word.replace(/s$/, "") === g));
}

export function clusterCellNames(names: (string | undefined)[]): CellCluster[] {
  const counts = new Map<string, number>();
  for (const raw of names) {
    const name = raw?.replace(/\s+/g, " ").trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  // Most-used spellings first, so each cluster is named after one of them;
  // on a tie, normal capitalisation beats ALL CAPS.
  const shouty = (n: string) => (n === n.toUpperCase() && /[A-Z]/.test(n) ? 1 : 0);
  const byUse = [...counts].sort((a, b) => b[1] - a[1] || shouty(a[0]) - shouty(b[0]) || a[0].localeCompare(b[0]));
  const clusters: { id: string; name: string; variants: string[]; count: number }[] = [];
  for (const [name, count] of byUse) {
    const hit = matchCell(name, clusters) ?? clusters.find((c) => c.variants.some((v) => matchCell(name, [{ id: c.id, name: v }])));
    if (hit) {
      hit.variants.push(name);
      hit.count += count;
    } else {
      clusters.push({ id: String(clusters.length), name, variants: [name], count });
    }
  }

  // "Platinum Cell" is suggested as "Platinum", "Swan Cell 3" as "Swan 3" —
  // they're already cells.
  const suggested = (name: string) => name.replace(/\bcel{1,2}\b/gi, "").replace(/\s+/g, " ").trim() || name;
  return clusters
    .map(({ name, variants, count }) => ({ name: suggested(name), variants, count, likelyCell: looksLikeCell(name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

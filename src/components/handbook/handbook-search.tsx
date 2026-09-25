"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SearchEntry } from "@/lib/handbook/search";

const MAX_RESULTS = 8;
const SNIPPET_RADIUS = 70;

function snippet(text: string, terms: string[]): string {
  const lower = text.toLowerCase();
  const at = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0));
  if (!Number.isFinite(at)) return text.slice(0, SNIPPET_RADIUS * 2);
  const start = Math.max(0, at - SNIPPET_RADIUS);
  return `${start > 0 ? "…" : ""}${text.slice(start, at + SNIPPET_RADIUS)}…`;
}

export function HandbookSearch({ index }: { index: SearchEntry[] }) {
  const [query, setQuery] = useState("");
  const terms = useMemo(() => query.toLowerCase().split(/\s+/).filter((t) => t.length > 1), [query]);

  const results = useMemo(() => {
    if (terms.length === 0) return [];
    return index
      .map((entry) => {
        const title = entry.title.toLowerCase();
        const body = entry.text.toLowerCase();
        if (!terms.every((t) => title.includes(t) || body.includes(t))) return null;
        // Title hits first, then by how often the terms appear.
        const score = terms.reduce((s, t) => s + (title.includes(t) ? 10 : 0) + body.split(t).length - 1, 0);
        return { entry, score };
      })
      .filter((r): r is { entry: SearchEntry; score: number } => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);
  }, [index, terms]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the handbook — e.g. “tenure”, “split a chapter”, “dues”"
        aria-label="Search the handbook"
        className="h-9 pl-9"
      />
      {terms.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-xl border bg-card">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">Nothing matches “{query.trim()}”.</p>
          ) : (
            <ul className="divide-y">
              {results.map(({ entry }) => (
                <li key={entry.href}>
                  <Link href={entry.href} className="block px-4 py-2.5 hover:bg-muted/60">
                    <p className="text-xs text-muted-foreground">{entry.trail}</p>
                    <p className="text-sm font-medium">{entry.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{snippet(entry.text, terms)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

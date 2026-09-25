import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// "Showing 11–20 of 105  ‹ 1 2 3 … 11 ›". Deliberately hook-free so both
// server pages (pass `hrefFor`, so paging is plain links) and client
// components (pass `onPageChange`) can use it.
export function PaginationBar({
  page,
  pageSize,
  total,
  hrefFor,
  onPageChange,
  className,
}: {
  page: number; // 1-based
  pageSize: number;
  total: number;
  hrefFor?: (page: number) => string;
  onPageChange?: (page: number) => void;
  className?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  // 1 … 4 5 6 … 11 — always the ends and the neighbours of the current page.
  const pages: (number | "gap")[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p === 1 || p === pageCount || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "gap") pages.push("gap");
  }

  function control(target: number, children: React.ReactNode, opts: { active?: boolean; disabled?: boolean; label: string }) {
    const button = (
      <Button
        type="button"
        size="sm"
        variant={opts.active ? "default" : "outline"}
        className="h-8 min-w-8 px-2"
        disabled={opts.disabled}
        aria-label={opts.label}
        aria-current={opts.active ? "page" : undefined}
        onClick={onPageChange ? () => onPageChange(target) : undefined}
      >
        {children}
      </Button>
    );
    if (hrefFor && !opts.disabled) {
      return (
        <Button asChild size="sm" variant={opts.active ? "default" : "outline"} className="h-8 min-w-8 px-2" aria-label={opts.label}>
          <Link href={hrefFor(target)} scroll={false}>
            {children}
          </Link>
        </Button>
      );
    }
    return button;
  }

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 pt-3", className)}>
      <p className="text-xs text-muted-foreground">
        Showing {first.toLocaleString()}–{last.toLocaleString()} of {total.toLocaleString()}
      </p>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        {control(page - 1, <ChevronLeft className="h-4 w-4" />, { disabled: page <= 1, label: "Previous page" })}
        {pages.map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
              …
            </span>
          ) : (
            <span key={p}>{control(p, p, { active: p === page, label: `Page ${p}` })}</span>
          )
        )}
        {control(page + 1, <ChevronRight className="h-4 w-4" />, { disabled: page >= pageCount, label: "Next page" })}
      </nav>
    </div>
  );
}

export function clampPage(raw: string | string[] | undefined, total: number, pageSize: number): number {
  const requested = Number(Array.isArray(raw) ? raw[0] : raw);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return Number.isInteger(requested) && requested >= 1 ? Math.min(requested, pageCount) : 1;
}

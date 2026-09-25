"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronRight, UsersRound } from "lucide-react";
import type { Role } from "@/lib/handbook/types";
import { cn } from "@/lib/utils";

const MAX_HOLDERS_SHOWN = 8;

export function OrgChart({
  roles,
  holders,
  initialRoleId,
}: {
  roles: Role[];
  // Office id → people holding it; null when the viewer can't see members.
  holders: Record<string, string[]> | null;
  initialRoleId?: string;
}) {
  const byId = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const children = useMemo(() => {
    const map = new Map<string | null, Role[]>();
    for (const r of roles) map.set(r.parentId, [...(map.get(r.parentId) ?? []), r]);
    return map;
  }, [roles]);
  const levels = useMemo(() => [...new Set(roles.map((r) => r.level))], [roles]);

  const [selectedId, setSelectedId] = useState(initialRoleId && byId.has(initialRoleId) ? initialRoleId : roles[0]?.id);
  const detailRef = useRef<HTMLDivElement>(null);
  const selected = selectedId ? byId.get(selectedId) : undefined;

  function select(id: string, scroll: boolean) {
    setSelectedId(id);
    // On narrow screens the detail sits below the outline — bring it into view.
    if (scroll && window.matchMedia("(max-width: 767px)").matches) {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const ancestors: Role[] = [];
  for (let r = selected; r?.parentId; ) {
    r = byId.get(r.parentId);
    if (r) ancestors.unshift(r);
  }

  function renderTree(parentId: string | null, depth: number) {
    const items = children.get(parentId);
    if (!items) return null;
    return (
      <ul className={cn(depth > 0 && "ml-3 border-l pl-2")}>
        {items.map((role) => {
          const count = holders?.[role.id]?.length ?? 0;
          const active = role.id === selectedId;
          return (
            <li key={role.id}>
              <button
                type="button"
                onClick={() => select(role.id, true)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "my-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full bg-current"
                  style={{ opacity: 1 - levels.indexOf(role.level) * (0.6 / Math.max(levels.length - 1, 1)) }}
                />
                <span className="min-w-0 flex-1 leading-snug">{role.title}</span>
                {count > 0 && (
                  <span className={cn("text-xs tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{count}</span>
                )}
              </button>
              {renderTree(role.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="grid gap-4 rounded-xl border p-3 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:p-4">
      <nav aria-label="Offices" className="md:max-h-[36rem] md:overflow-y-auto md:border-r md:pr-3">
        <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 px-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          {levels.map((level, i) => (
            <span key={level} className="flex items-center gap-1">
              <span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-foreground"
                style={{ opacity: 1 - i * (0.6 / Math.max(levels.length - 1, 1)) }}
              />
              {level}
            </span>
          ))}
        </div>
        {renderTree(null, 0)}
      </nav>

      {selected && (
        <div ref={detailRef} className="min-w-0 scroll-mt-20 space-y-4 md:px-2">
          {ancestors.length > 0 && (
            <nav aria-label="Reporting line" className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              {ancestors.map((a) => (
                <span key={a.id} className="flex items-center gap-1">
                  <button type="button" className="hover:text-foreground hover:underline" onClick={() => select(a.id, false)}>
                    {a.title}
                  </button>
                  <ChevronRight className="h-3 w-3" />
                </span>
              ))}
            </nav>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">{selected.level}</p>
            <h3 className="text-lg font-semibold leading-snug">{selected.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{selected.summary}</p>
          </div>

          {holders && selected.position && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <UsersRound className="h-3.5 w-3.5" />
                In this zone
              </p>
              {(holders[selected.id] ?? []).length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">Nobody is recorded in this office yet.</p>
              ) : (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {holders[selected.id].slice(0, MAX_HOLDERS_SHOWN).map((name) => (
                    <li key={name} className="rounded-full bg-card px-2.5 py-0.5 text-xs ring-1 ring-foreground/10">
                      {name}
                    </li>
                  ))}
                  {holders[selected.id].length > MAX_HOLDERS_SHOWN && (
                    <li className="px-1 py-0.5 text-xs text-muted-foreground">+{holders[selected.id].length - MAX_HOLDERS_SHOWN} more</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {selected.facts.length > 0 && (
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8.5rem_minmax(0,1fr)]">
              {selected.facts.map((f) => (
                <div key={f.label} className="contents">
                  <dt className="font-medium text-muted-foreground">{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}

          {selected.responsibilities.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium">Responsibilities</p>
              <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed marker:text-muted-foreground">
                {selected.responsibilities.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {(children.get(selected.id) ?? []).length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-medium">Oversees</p>
              <div className="flex flex-wrap gap-1.5">
                {children.get(selected.id)!.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => select(c.id, false)}
                    className="rounded-full border px-2.5 py-1 text-xs hover:border-primary/50 hover:bg-primary/5"
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

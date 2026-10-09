"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Combine, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RenameChapterDialog } from "@/components/dashboard/rename-chapter-dialog";
import { MoveChapterSelect } from "./sub-zone-dialogs";
import { addCountry, mergeChapters, setChapterCountry } from "@/lib/actions/sub-zones";
import type { StructureIssue } from "@/lib/structure";
import { labels, lower } from "@/lib/labels";
import { cn, pluralize } from "@/lib/utils";

export type TidyRow = {
  id: string;
  name: string;
  countryId: string;
  subZoneId?: string;
  memberCount: number;
  cellCount: number;
  leaders: string[];
  issues: StructureIssue[];
};

type Option = { id: string; name: string };
type CountryOption = Option & { flag: string };
type Filter = "all" | StructureIssue["kind"];

const ALL = "__all";
const NONE = "__none";

export function StructureTidy({
  rows,
  countries,
  subZones,
  leaderTitle,
}: {
  rows: TidyRow[];
  countries: CountryOption[];
  subZones: Option[];
  leaderTitle?: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [subZone, setSubZone] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  const [merging, setMerging] = useState<TidyRow | null>(null);

  const count = (kind: StructureIssue["kind"]) => rows.filter((r) => r.issues.some((i) => i.kind === kind)).length;
  const chips: { key: Filter; label: string; n: number }[] = [
    { key: "all", label: `All ${lower(labels.locations)}`, n: rows.length },
    { key: "no_sub_zone", label: `Not in a ${lower(labels.subZone)}`, n: count("no_sub_zone") },
    { key: "country", label: `${labels.country} looks off`, n: count("country") },
    { key: "duplicate", label: "Possible duplicates", n: count("duplicate") },
    ...(leaderTitle ? [{ key: "no_leader" as const, label: `No ${leaderTitle.toLowerCase()}`, n: count("no_leader") }] : []),
  ];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.issues.some((i) => i.kind === filter)) &&
        (!q || r.name.toLowerCase().includes(q)) &&
        (subZone === ALL || (subZone === NONE ? !r.subZoneId : r.subZoneId === subZone)) &&
        (country === ALL || r.countryId === country)
    );
  }, [rows, filter, query, subZone, country]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(c.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              filter === c.key ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40",
              c.key !== "all" && c.n === 0 && filter !== c.key && "text-muted-foreground"
            )}
          >
            {c.label} <span className="opacity-70">{c.n}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${lower(labels.locations)}`} className="pl-8" />
        </div>
        <Select value={subZone} onValueChange={setSubZone}>
          <SelectTrigger className="w-full sm:w-44" aria-label={`Filter by ${lower(labels.subZone)}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Every {lower(labels.subZone)}</SelectItem>
            {subZones.map((z) => (
              <SelectItem key={z.id} value={z.id}>
                {z.name}
              </SelectItem>
            ))}
            <SelectItem value={NONE}>Not in a {lower(labels.subZone)}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="w-full sm:w-44" aria-label={`Filter by ${lower(labels.country)}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Every {lower(labels.country)}</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.flag} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AddCountryDialog />
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {pluralize(shown.length, lower(labels.location), lower(labels.locations))}. Changes save as soon as you pick
        them.
      </p>

      <div className="divide-y rounded-xl border">
        {shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nothing to show — all tidy here.</p>}
        {shown.map((r) => (
          <div key={r.id} className="space-y-2 p-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <Link href={`/churches/${r.id}`} className="truncate text-sm font-medium hover:text-primary hover:underline">
                    {r.name}
                  </Link>
                  <RenameChapterDialog churchId={r.id} currentName={r.name} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {leaderTitle && `${leaderTitle}: ${r.leaders.length ? r.leaders.join(", ") : "none"} · `}
                  {pluralize(r.memberCount, "member")} · {pluralize(r.cellCount, lower(labels.cell), lower(labels.cells))}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <CountrySelect churchId={r.id} countryId={r.countryId} countries={countries} />
                <MoveChapterSelect churchId={r.id} subZoneId={r.subZoneId} subZones={subZones} />
                <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setMerging(r)}>
                  <Combine className="h-3.5 w-3.5" /> Merge…
                </Button>
              </div>
            </div>
            {r.issues.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {r.issues.map((issue, i) => (
                  <IssueBadge key={i} issue={issue} leaderTitle={leaderTitle} onMerge={() => setMerging(r)} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {merging && (
        <MergeDialog
          from={merging}
          rows={rows}
          countries={countries}
          suggested={merging.issues.find((i): i is Extract<StructureIssue, { kind: "duplicate" }> => i.kind === "duplicate")?.ofId}
          onClose={() => setMerging(null)}
        />
      )}
    </div>
  );
}

function IssueBadge({ issue, leaderTitle, onMerge }: { issue: StructureIssue; leaderTitle?: string; onMerge: () => void }) {
  const text =
    issue.kind === "no_sub_zone"
      ? `Not in a ${lower(labels.subZone)}`
      : issue.kind === "country"
        ? `The others in this ${lower(labels.subZone)} are in ${issue.usual}`
        : issue.kind === "duplicate"
          ? `Same place as ${issue.ofName}?`
          : `No ${leaderTitle?.toLowerCase() ?? "leader"} recorded`;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-normal", issue.kind !== "no_leader" && "border-amber-500/50 text-amber-700 dark:text-amber-400")}
      onClick={issue.kind === "duplicate" ? onMerge : undefined}
      role={issue.kind === "duplicate" ? "button" : undefined}
    >
      <AlertTriangle className="h-3 w-3" />
      {text}
    </Badge>
  );
}

function CountrySelect({ churchId, countryId, countries }: { churchId: string; countryId: string; countries: CountryOption[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Select
        value={countryId}
        disabled={pending}
        onValueChange={(v) =>
          start(async () => {
            setError(null);
            const result = await setChapterCountry(churchId, v);
            if (!result.ok) return setError(result.error);
            router.refresh();
          })
        }
      >
        <SelectTrigger className="h-8 w-full text-xs sm:w-40" aria-label={`${labels.country}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {countries.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.flag} {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function AddCountryDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setName("");
          setError(null);
        }
      }}
    >
      <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> {labels.country}
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add a {lower(labels.country)}</DialogTitle>
          <DialogDescription>For a {lower(labels.location)} in a {lower(labels.country)} that isn&apos;t listed yet.</DialogDescription>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lesotho" autoFocus />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            disabled={pending || !name.trim()}
            onClick={() =>
              start(async () => {
                const result = await addCountry(name);
                if (!result.ok) return setError(result.error);
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MergeDialog({
  from,
  rows,
  countries,
  suggested,
  onClose,
}: {
  from: TidyRow;
  rows: TidyRow[];
  countries: CountryOption[];
  suggested?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [into, setInto] = useState(suggested ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const target = rows.find((r) => r.id === into);
  const others = rows.filter((r) => r.id !== from.id);
  const flag = (countryId: string) => countries.find((c) => c.id === countryId)?.flag ?? "";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge {from.name}</DialogTitle>
          <DialogDescription>
            For two {lower(labels.locations)} that are really the same place. Everything in {from.name} — its{" "}
            {pluralize(from.memberCount, "member")}, {lower(labels.cells)} and records — moves into the one you choose, and{" "}
            {from.name} is removed.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <p className="text-sm">{done}</p>
        ) : (
          <>
            <Select value={into} onValueChange={setInto}>
              <SelectTrigger className="w-full" aria-label="Merge into">
                <SelectValue placeholder={`Choose the ${lower(labels.location)} to keep`} />
              </SelectTrigger>
              <SelectContent>
                {others.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {flag(r.countryId)} {r.name} ({pluralize(r.memberCount, "member")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {target && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                Keep <strong>{target.name}</strong>; {from.name} goes. Members end up with {target.name}&apos;s{" "}
                {lower(labels.country)} and {lower(labels.subZone)}. This can&apos;t be undone.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </>
        )}
        <DialogFooter>
          {done ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending || !target}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const result = await mergeChapters(from.id, into);
                    if (!result.ok) return setError(result.error);
                    setDone(`Merged — ${pluralize(result.moved, "member")} moved to ${target!.name}.`);
                    router.refresh();
                  })
                }
              >
                {pending ? "Merging…" : "Merge"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

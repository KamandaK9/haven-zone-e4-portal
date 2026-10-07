"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { tenant } from "@/tenant";
import { parseZoneMemberSheet } from "@/lib/import/parse-zone-members";
import { parseMemberSheet } from "@/lib/import/parse-members";
import { clusterCellNames, type CellCluster } from "@/lib/import/cluster-cells";
import { downloadMemberTemplate } from "@/lib/import/member-template";
import type { WizardState } from "./types";

// Setup's member-list import. Takes the organisation's sheet as it is:
// - with Country and Church columns, members are placed by those (and the
//   previous step's list is replaced with what the file names);
// - without, everyone goes into the church entered on the previous step, and
//   the sheet's cell names are offered back — spelling variants merged — for
//   the admin to confirm before those cells are created.

type CellChoice = { action: "create" | "none" | "merge"; name: string; into?: string };

export function MemberListImportPanel({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const [stage, setStage] = useState<"idle" | "dragging" | "parsing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [details, setDetails] = useState<{ ageGroups: Record<string, number>; ignored: string[] } | null>(null);
  const [clusters, setClusters] = useState<CellCluster[]>([]);
  const [choices, setChoices] = useState<Record<string, CellChoice>>({});
  // True when the sheet had no Country/Church columns — everyone goes into one church.
  const [flat, setFlat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const churches = useMemo(
    () =>
      wizard.countries.flatMap((c) =>
        c.name.trim() ? c.churches.filter((n) => n.trim()).map((ch) => ({ country: c.name.trim(), church: ch.trim() })) : []
      ),
    [wizard.countries]
  );
  const target = wizard.importedMembers[0];

  // Every spelling in the sheet → the cell it ends up as, per the choices.
  function applyChoices(next: Record<string, CellChoice>, list = clusters) {
    const resolve = (c: CellCluster, seen = new Set<string>()): string | null => {
      const choice = next[c.name];
      if (!choice || choice.action === "none") return null;
      if (choice.action === "merge" && choice.into && !seen.has(c.name)) {
        const into = list.find((x) => x.name === choice.into);
        return into ? resolve(into, seen.add(c.name)) : null;
      }
      return choice.name.trim() || c.name;
    };
    const cellMap: Record<string, string | null> = {};
    for (const c of list) for (const v of c.variants) cellMap[v] = resolve(c);
    setChoices(next);
    setWizard((w) => ({ ...w, cellMap }));
  }

  function moveToChurch(key: string) {
    const [country, church] = key.split("::");
    setWizard((w) => ({
      ...w,
      importedMembers: w.importedMembers.map((r) => ({ ...r, countryName: country, churchName: church })),
    }));
  }

  async function handleFile(file: File) {
    setStage("parsing");
    setError(null);
    setSummary(null);
    setDetails(null);
    setClusters([]);
    setFlat(false);
    try {
      // A sheet with Country and Church columns places members itself.
      const zoned = await parseZoneMemberSheet(file);
      if (zoned.rows.length > 0) {
        setWizard((w) => ({
          ...w,
          importFileName: file.name,
          countries: zoned.countries,
          importedMembers: zoned.rows,
          cellMap: {},
        }));
        const churchCount = zoned.countries.reduce((sum, c) => sum + c.churches.length, 0);
        setSummary(
          `${zoned.rows.length.toLocaleString()} members across ${zoned.countries.length} countries and ${churchCount} churches. The previous step's list has been replaced with what came from this file.`
        );
        setStage("idle");
        return;
      }

      const parsed = await parseMemberSheet(file);
      if (parsed.rows.length === 0) {
        setError("No members found in that file — it needs at least a column of names.");
        setStage("error");
        return;
      }

      // Everyone goes into a church from the previous step — or, if none was
      // entered, one named after the organisation.
      let home = churches[0];
      if (!home) {
        const country = wizard.countries.find((c) => c.name.trim())?.name.trim() ?? tenant.countries[0]?.name ?? "Country";
        home = { country, church: tenant.defaultOrgName };
        setWizard((w) => {
          const countries = w.countries.some((c) => c.name.trim() === country)
            ? w.countries.map((c) => (c.name.trim() === country ? { ...c, churches: [...c.churches.filter((n) => n.trim()), home!.church] } : c))
            : [...w.countries, { name: country, churches: [home!.church] }];
          return { ...w, countries };
        });
      }

      const found = clusterCellNames(parsed.rows.map((r) => r.cellName));
      const initial: Record<string, CellChoice> = Object.fromEntries(
        found.map((c) => [c.name, { action: c.likelyCell ? "create" : "none", name: c.name }])
      );
      setClusters(found);
      setFlat(true);
      setWizard((w) => ({
        ...w,
        importFileName: file.name,
        importedMembers: parsed.rows.map((member) => ({ countryName: home!.country, churchName: home!.church, member })),
      }));
      applyChoices(initial, found);

      const ageGroups: Record<string, number> = {};
      for (const r of parsed.rows) {
        const label = tenant.ageGroups?.find((g) => g.key === r.ageGroup)?.label;
        if (label) ageGroups[label] = (ageGroups[label] ?? 0) + 1;
      }
      setDetails({ ageGroups, ignored: parsed.ignoredHeaders });
      setSummary(
        `${parsed.rows.length.toLocaleString()} members found${parsed.skipped.length > 0 ? ` (${parsed.skipped.length} row(s) skipped — no name)` : ""}.`
      );
      setStage("idle");
    } catch {
      setError("Couldn't read that file. Make sure it's a valid .xlsx, .xls, or .csv.");
      setStage("error");
    }
  }

  function clear() {
    setWizard((w) => ({ ...w, importFileName: null, importedMembers: [], churchMeta: {}, cellMap: {} }));
    setSummary(null);
    setDetails(null);
    setClusters([]);
    setChoices({});
    setFlat(false);
    setError(null);
    setStage("idle");
  }

  const cellLabel = tenant.labels.cell.toLowerCase();
  const creating = clusters.filter((c) => choices[c.name]?.action === "create");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Your member list as you already keep it — any columns, in any order. Columns we don&apos;t use are ignored.
        </p>
        <button
          type="button"
          onClick={() => downloadMemberTemplate()}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Download className="h-3 w-3" /> Starting from scratch? Download a template
        </button>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setStage("dragging");
        }}
        onDragLeave={() => setStage(stage === "dragging" ? "idle" : stage)}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
          stage === "dragging" ? "border-primary bg-accent" : "border-border hover:bg-muted/50"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {stage === "parsing" ? (
          <p className="text-sm font-medium text-muted-foreground">Reading file…</p>
        ) : wizard.importFileName ? (
          <>
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <p className="text-sm font-medium">{wizard.importFileName}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" /> remove
            </button>
          </>
        ) : (
          <>
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drag &amp; drop your member spreadsheet here</p>
            <p className="text-xs text-muted-foreground">or click to browse — .xlsx, .xls, .csv</p>
          </>
        )}
      </div>

      {stage === "error" && error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {summary && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p>{summary}</p>
            {details && Object.keys(details.ageGroups).length > 0 && (
              <p>
                {Object.entries(details.ageGroups)
                  .map(([label, n]) => `${label}: ${n}`)
                  .join(" · ")}
              </p>
            )}
            {details && details.ignored.length > 0 && <p>Not imported: {details.ignored.join(", ")}</p>}
          </div>
        </div>
      )}

      {flat && target && churches.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Which church are these members in?</p>
          <Select value={`${target.countryName}::${target.churchName}`} onValueChange={moveToChurch}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {churches.map((c) => (
                <SelectItem key={`${c.country}::${c.church}`} value={`${c.country}::${c.church}`}>
                  {c.church} ({c.country})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {clusters.length > 0 && (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">
              {tenant.labels.cellPlural} in your sheet — {creating.length} will be created
            </p>
            <p className="text-xs text-muted-foreground">
              Different spellings of the same {cellLabel} are already grouped together. Rename one, fold it into
              another, or mark it as not a {cellLabel} — its members are still imported, just without a {cellLabel}.
            </p>
          </div>
          <div className="rounded-xl border divide-y">
            {clusters.map((c) => {
              const choice = choices[c.name] ?? { action: "none", name: c.name };
              const set = (patch: Partial<CellChoice>) => applyChoices({ ...choices, [c.name]: { ...choice, ...patch } });
              return (
                <div key={c.name} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                  <div className="flex-1 min-w-0">
                    {choice.action === "create" ? (
                      <Input value={choice.name} onChange={(e) => set({ name: e.target.value })} className="h-8" />
                    ) : (
                      <p className={cn("text-sm", choice.action === "none" && "text-muted-foreground line-through")}>
                        {c.name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {c.count} member{c.count === 1 ? "" : "s"}
                      {c.variants.length > 1 && ` · also spelled ${c.variants.filter((v) => v !== c.name).join(", ")}`}
                    </p>
                  </div>
                  <Select
                    value={choice.action === "merge" ? `merge:${choice.into}` : choice.action}
                    onValueChange={(v) =>
                      v.startsWith("merge:") ? set({ action: "merge", into: v.slice(6) }) : set({ action: v as CellChoice["action"] })
                    }
                  >
                    <SelectTrigger className="w-full sm:w-56 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create">Create this {cellLabel}</SelectItem>
                      <SelectItem value="none">Not a {cellLabel}</SelectItem>
                      {clusters
                        .filter((o) => o.name !== c.name && choices[o.name]?.action === "create")
                        .map((o) => (
                          <SelectItem key={o.name} value={`merge:${o.name}`}>
                            Same as {choices[o.name]?.name || o.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

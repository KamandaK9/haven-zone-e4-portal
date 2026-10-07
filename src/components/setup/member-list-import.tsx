"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { tenant } from "@/tenant";
import { downloadMemberTemplate } from "@/lib/import/member-template";
import { ColumnMapper } from "@/components/members/column-mapper";
import { mappingProblem } from "@/lib/import/column-mapping";
import type { ColumnMapping } from "@/lib/import/parse-members";
import { churchOptions, draftMemberField, loadMemberSheet, memberCount, memberListFrom, type CellChoice } from "./member-list";
import type { WizardState } from "./types";

// Setup's member-list import. Takes the organisation's sheet as it is (see
// member-list.ts); for a list with no Country/Church columns, the admin
// matches each column (to a member detail, a field of their own, or nothing),
// then sees which church its members go into and the cells found in it —
// spelling variants grouped — to confirm before setup creates them. A sheet
// already loaded on the Countries & churches step shows up here as-is.
export function MemberListImportPanel({
  wizard,
  setWizard,
}: {
  wizard: WizardState;
  setWizard: React.Dispatch<React.SetStateAction<WizardState>>;
}) {
  const [stage, setStage] = useState<"idle" | "dragging" | "parsing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [zonedSummary, setZonedSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const list = wizard.memberList;
  const churches = churchOptions(wizard);
  const target = churches.find((c) => c.key === list?.target) ?? churches[0];

  async function handleFile(file: File) {
    setStage("parsing");
    setError(null);
    setZonedSummary(null);
    const loaded = await loadMemberSheet(file);
    if (!loaded.ok) {
      setError(loaded.error);
      setStage("error");
      return;
    }
    setWizard(loaded.apply);
    if (loaded.kind === "zoned") setZonedSummary(loaded.summary);
    setStage("idle");
  }

  function clear() {
    setWizard((w) => ({ ...w, importFileName: null, importedMembers: [], churchMeta: {}, memberList: null, memberFields: [] }));
    setZonedSummary(null);
    setError(null);
    setStage("idle");
  }

  function setMapping(mapping: ColumnMapping) {
    setWizard((w) =>
      w.memberList
        ? { ...w, memberList: memberListFrom(w.memberList.fileName, w.memberList.sheets, w.memberList.columns, mapping, w.memberList) }
        : w
    );
  }

  function setChoice(clusterName: string, patch: Partial<CellChoice>) {
    setWizard((w) =>
      w.memberList
        ? {
            ...w,
            memberList: {
              ...w.memberList,
              choices: { ...w.memberList.choices, [clusterName]: { ...w.memberList.choices[clusterName], ...patch } },
            },
          }
        : w
    );
  }

  const cellLabel = tenant.labels.cell.toLowerCase();
  const creating = list ? list.clusters.filter((c) => list.choices[c.name]?.action === "create") : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Your member list as you already keep it — any columns, in any order. Columns we don&apos;t use are ignored.
        </p>
        <button
          type="button"
          onClick={() => downloadMemberTemplate(wizard.memberFields)}
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

      {(zonedSummary || list) && (
        <div className="flex items-start gap-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2.5 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {zonedSummary && <p>{zonedSummary}</p>}
            {list && (
              <>
                <p>
                  {memberCount(wizard).toLocaleString()} members ready to import
                  {target ? ` into ${target.church}` : ""}
                  {list.skipped > 0 ? ` (${list.skipped} row(s) skipped — no name)` : ""}.
                </p>
                {Object.keys(list.ageGroups).length > 0 && (
                  <p>
                    {Object.entries(list.ageGroups)
                      .map(([label, n]) => `${label}: ${n}`)
                      .join(" · ")}
                  </p>
                )}
                {list.ignored.length > 0 && <p>Not imported: {list.ignored.join(", ")}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {list && (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">What&apos;s in each column?</p>
            <p className="text-xs text-muted-foreground">
              We&apos;ve matched what we recognise — check it. A column you want to keep that isn&apos;t a standard
              detail (a baptism date, a department) can become a field of your own: choose &ldquo;New field from this
              column&rdquo;. These choices are saved, so your next import of this sheet matches itself.
            </p>
          </div>
          <ColumnMapper
            columns={list.columns}
            mapping={list.mapping}
            onChange={setMapping}
            fields={wizard.memberFields}
            onFieldCreated={(field) => setWizard((w) => ({ ...w, memberFields: [...w.memberFields, field] }))}
            canCreateFields
            createField={async (input) => draftMemberField(input, wizard.memberFields)}
          />
          {mappingProblem(list.mapping) && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {mappingProblem(list.mapping)}
            </p>
          )}
        </div>
      )}

      {list && churches.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Which church are these members in?</p>
          <Select
            value={target?.key}
            onValueChange={(key) => setWizard((w) => (w.memberList ? { ...w, memberList: { ...w.memberList, target: key } } : w))}
          >
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {churches.map((c) => (
                <SelectItem key={c.key} value={c.key}>
                  {c.church} ({c.country})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {list && list.clusters.length > 0 && (
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
            {list.clusters.map((c) => {
              const choice = list.choices[c.name] ?? { action: "none", name: c.name };
              return (
                <div key={c.name} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                  <div className="flex-1 min-w-0">
                    {choice.action === "create" ? (
                      <Input value={choice.name} onChange={(e) => setChoice(c.name, { name: e.target.value })} className="h-8" />
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
                      v.startsWith("merge:")
                        ? setChoice(c.name, { action: "merge", into: v.slice(6) })
                        : setChoice(c.name, { action: v as CellChoice["action"] })
                    }
                  >
                    <SelectTrigger className="w-full sm:w-56 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="create">Create this {cellLabel}</SelectItem>
                      <SelectItem value="none">Not a {cellLabel}</SelectItem>
                      {list.clusters
                        .filter((o) => o.name !== c.name && list.choices[o.name]?.action === "create")
                        .map((o) => (
                          <SelectItem key={o.name} value={`merge:${o.name}`}>
                            Same as {list.choices[o.name]?.name || o.name}
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

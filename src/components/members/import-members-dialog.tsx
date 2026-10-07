"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, UploadCloud, CheckCircle2, X, AlertCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { ColumnMapper } from "./column-mapper";
import { memberSheets, parseMemberSheets, type ColumnMapping, type ParseResult } from "@/lib/import/parse-members";
import { importColumns, mappingProblem, suggestMapping, type ImportColumn } from "@/lib/import/column-mapping";
import { saveImportTemplate } from "@/lib/actions/member-fields";
import type { MemberField } from "@/lib/custom-fields";
import { downloadMemberTemplate } from "@/lib/import/member-template";
import { bulkImportMembers, type BulkImportResult } from "@/lib/actions/members";

type Stage = "idle" | "dragging" | "parsing" | "match" | "preview" | "importing" | "done" | "error";
type Sheets = Awaited<ReturnType<typeof memberSheets>>;

export function ImportMembersDialog({
  churchName,
  churchId,
  countryId,
  fields: initialFields = [],
  template = null,
  canManageSettings = false,
}: {
  churchName: string;
  churchId: string;
  countryId: string;
  // The organisation's own member fields and saved column template.
  fields?: MemberField[];
  template?: ColumnMapping | null;
  canManageSettings?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [sheets, setSheets] = useState<Sheets | null>(null);
  const [columns, setColumns] = useState<ImportColumn[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fields, setFields] = useState<MemberField[]>(initialFields);
  const [remember, setRemember] = useState(canManageSettings);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStage("idle");
    setFileName("");
    setParsed(null);
    setSheets(null);
    setColumns([]);
    setMapping({});
    setResult(null);
    setErrorMsg(null);
  }

  async function pickFile(file: File) {
    setFileName(file.name);
    setStage("parsing");
    try {
      const read = await memberSheets(file);
      const cols = importColumns(read.sheets);
      if (cols.length === 0 || read.sheets.every((s) => s.rows.length === 0)) {
        setErrorMsg("No rows found in that file.");
        setStage("error");
        return;
      }
      setSheets(read);
      setColumns(cols);
      setMapping(suggestMapping(cols, { template, fields }));
      setStage("match");
    } catch {
      setErrorMsg("Couldn't read that file. Make sure it's a valid .xlsx, .xls, or .csv.");
      setStage("error");
    }
  }

  function applyMapping() {
    if (!sheets) return;
    const parseResult = parseMemberSheets(sheets, mapping);
    if (parseResult.rows.length === 0 && parseResult.skipped.length === 0) {
      setErrorMsg("No people found with those columns — check which column holds names.");
      setStage("error");
      return;
    }
    setParsed(parseResult);
    setStage("preview");
  }

  async function confirmImport() {
    if (!parsed) return;
    setStage("importing");
    // Next time, this organisation's sheet is matched the same way.
    if (canManageSettings && remember) await saveImportTemplate(mapping);
    const importResult = await bulkImportMembers({ churchId, countryId, rows: parsed.rows });
    setResult(importResult);
    setStage("done");
    if (importResult.ok) router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Import from Excel
        </Button>
      </DialogTrigger>
      <DialogContent className={cn(stage === "match" ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>Import members</DialogTitle>
          <DialogDescription>Bulk-add members to {churchName} from a spreadsheet.</DialogDescription>
        </DialogHeader>

        {stage === "done" && result ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className={cn("rounded-full p-3", result.ok ? "bg-emerald-100" : "bg-red-100")}>
              {result.ok ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : (
                <AlertCircle className="h-6 w-6 text-red-600" />
              )}
            </div>
            {result.ok ? (
              <div>
                <p className="font-medium">
                  {result.inserted} member{result.inserted === 1 ? "" : "s"} imported
                </p>
                {result.errors.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {result.errors.length} row{result.errors.length === 1 ? "" : "s"} skipped —{" "}
                    {result.errors.map((e) => `row ${e.row} (${e.reason})`).join(", ")}
                  </p>
                )}
                {result.unmatchedCells && result.unmatchedCells.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Imported without a cell (no matching cell in {churchName}):{" "}
                    {result.unmatchedCells.map((c) => `${c.name} (${c.count})`).join(", ")}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{result.error}</p>
            )}
          </div>
        ) : stage === "match" ? (
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">
              Choose what each column in <span className="font-medium text-foreground">{fileName}</span> is. Columns you
              don&apos;t need can stay as &ldquo;Don&apos;t import&rdquo;.
            </p>
            <ColumnMapper
              columns={columns}
              mapping={mapping}
              onChange={setMapping}
              fields={fields}
              onFieldCreated={(f) => setFields((fs) => [...fs, f])}
              canCreateFields={canManageSettings}
            />
            {mappingProblem(mapping) && <p className="text-xs text-destructive">{mappingProblem(mapping)}</p>}
            {canManageSettings && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                Remember these choices for next time
              </label>
            )}
          </div>
        ) : stage === "preview" && parsed ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-sm font-medium">
                {parsed.rows.length} member{parsed.rows.length === 1 ? "" : "s"} ready to import
              </p>
              {parsed.matchedHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Matched columns: {parsed.matchedHeaders.map((m) => m.header).join(", ")}
                </p>
              )}
              {parsed.ignoredHeaders.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Ignored columns: {parsed.ignoredHeaders.join(", ")}
                </p>
              )}
            </div>
            {parsed.skipped.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">
                  {parsed.skipped.length} row{parsed.skipped.length === 1 ? "" : "s"} will be skipped
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                  {parsed.skipped.slice(0, 5).map((s, i) => (
                    <li key={i}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                  {parsed.skipped.length > 5 && <li>…and {parsed.skipped.length - 5} more</li>}
                </ul>
              </div>
            )}
          </div>
        ) : stage === "error" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setStage("dragging");
            }}
            onDragLeave={() => setStage((s) => (s === "dragging" ? "idle" : s))}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) pickFile(file);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
              stage === "dragging" ? "border-primary bg-accent" : "border-border hover:bg-muted/50"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
            />
            {stage === "parsing" ? (
              <>
                <FileSpreadsheet className="h-8 w-8 text-primary animate-pulse" />
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">Reading file…</p>
              </>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drag &amp; drop a spreadsheet here</p>
                <p className="text-xs text-muted-foreground">or click to browse — .xlsx, .xls, .csv</p>
              </>
            )}
          </div>
        )}
        {(stage === "idle" || stage === "dragging") && (
          <button
            type="button"
            onClick={() => downloadMemberTemplate(fields)}
            className="flex items-center gap-1 self-start text-xs text-primary hover:underline"
          >
            <Download className="h-3 w-3" /> No spreadsheet yet? Download a template
          </button>
        )}

        <DialogFooter>
          {stage === "done" || stage === "error" ? (
            <Button
              onClick={() => {
                if (stage === "error") reset();
                else setOpen(false);
              }}
            >
              {stage === "error" ? "Try again" : "Done"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => (stage === "preview" ? setStage("match") : stage === "match" ? reset() : setOpen(false))}
              >
                {stage === "preview" ? (
                  "Back to columns"
                ) : stage === "match" ? (
                  <>
                    <X className="h-3.5 w-3.5" /> Choose a different file
                  </>
                ) : (
                  "Cancel"
                )}
              </Button>
              {stage === "match" ? (
                <Button type="button" disabled={!!mappingProblem(mapping)} onClick={applyMapping}>
                  Continue
                </Button>
              ) : (
                <Button type="button" disabled={stage !== "preview"} onClick={confirmImport}>
                  {stage === "importing" ? "Importing…" : "Confirm import"}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

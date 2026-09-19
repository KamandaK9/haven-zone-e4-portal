"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, UploadCloud, CheckCircle2, AlertCircle, X } from "lucide-react";
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
import { parseLedgerSheet, type LedgerParseResult } from "@/lib/import/parse-ledger";
import { bulkImportLedgerEntries, type BulkLedgerImportResult } from "@/lib/actions/ledger";
import type { Church } from "@/lib/data/types";

type Stage = "idle" | "dragging" | "parsing" | "preview" | "importing" | "done" | "error";

export function ImportLedgerDialog({ churches }: { churches: Church[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [parsed, setParsed] = useState<LedgerParseResult | null>(null);
  const [result, setResult] = useState<BulkLedgerImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStage("idle");
    setParsed(null);
    setResult(null);
    setErrorMsg(null);
  }

  async function pickFile(file: File) {
    setStage("parsing");
    try {
      const parseResult = await parseLedgerSheet(file, churches);
      if (parseResult.rows.length === 0 && parseResult.skipped.length === 0) {
        setErrorMsg("No rows found in that file.");
        setStage("error");
        return;
      }
      setParsed(parseResult);
      setStage("preview");
    } catch {
      setErrorMsg("Couldn't read that file. Make sure it's a valid .xlsx, .xls, or .csv.");
      setStage("error");
    }
  }

  async function confirmImport() {
    if (!parsed) return;
    setStage("importing");
    const importResult = await bulkImportLedgerEntries(parsed.rows);
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
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import ledger entries</DialogTitle>
          <DialogDescription>
            One row per entry, with Church, Type (income/expense), Category, Amount, and Date columns.
          </DialogDescription>
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
              <p className="font-medium">
                {result.inserted} entr{result.inserted === 1 ? "y" : "ies"} imported
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{result.error}</p>
            )}
          </div>
        ) : stage === "preview" && parsed ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">
                {parsed.rows.length} entr{parsed.rows.length === 1 ? "y" : "ies"} ready to import
              </p>
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
              <p className="text-sm font-medium text-muted-foreground">Reading file…</p>
            ) : (
              <>
                <UploadCloud className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drag &amp; drop a spreadsheet here</p>
                <p className="text-xs text-muted-foreground">or click to browse — .xlsx, .xls, .csv</p>
              </>
            )}
          </div>
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
              <Button type="button" variant="outline" onClick={() => (stage === "preview" ? reset() : setOpen(false))}>
                {stage === "preview" ? (
                  <>
                    <X className="h-3.5 w-3.5" /> Choose a different file
                  </>
                ) : (
                  "Cancel"
                )}
              </Button>
              <Button type="button" disabled={stage !== "preview"} onClick={confirmImport}>
                {stage === "importing" ? "Importing…" : "Confirm import"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, UploadCloud, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { GIVING_CATEGORIES } from "@/lib/giving";
import { formatMoney, type CurrencyCode } from "@/lib/currency";
import { parseGivingSheet, type GivingMatchMember, type GivingParseResult } from "@/lib/import/parse-giving";
import { bulkImportGiving, type BulkGivingImportResult } from "@/lib/actions/giving";
import type { Church } from "@/lib/data/types";

type Stage = "idle" | "dragging" | "parsing" | "preview" | "importing" | "done" | "error";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function ImportGivingDialog({
  members,
  churches,
  currency = "USD",
  rates = {},
}: {
  members: GivingMatchMember[];
  churches: Church[];
  currency?: CurrencyCode;
  rates?: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [defaultMonth, setDefaultMonth] = useState(currentMonth());
  const [parsed, setParsed] = useState<GivingParseResult | null>(null);
  const [result, setResult] = useState<BulkGivingImportResult | null>(null);
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
      const parseResult = await parseGivingSheet(file, members, churches, defaultMonth || currentMonth());
      if (parseResult.rows.length === 0 && parseResult.skipped.length === 0) {
        setErrorMsg("No giving found in that file.");
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
    const importResult = await bulkImportGiving(parsed.rows);
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
          <HandCoins className="h-4 w-4" />
          Import giving
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import giving</DialogTitle>
          <DialogDescription>
            One row per member, matched by Email or Name. Add a column for each of PCO, Dues, Special Project and
            META — or use a Category column plus an Amount column. Re-importing a month replaces its amounts.
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
                {result.imported} giving entr{result.imported === 1 ? "y" : "ies"} imported for {result.members}{" "}
                member{result.members === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{result.error}</p>
            )}
          </div>
        ) : stage === "preview" && parsed ? (
          <div className="space-y-3 py-2">
            {parsed.rows.length > 0 ? (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">
                  {parsed.rows.length} entr{parsed.rows.length === 1 ? "y" : "ies"} for {parsed.memberCount} member
                  {parsed.memberCount === 1 ? "" : "s"} ready to import
                </p>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {GIVING_CATEGORIES.map((c) => (
                    <li key={c.id} className="flex justify-between">
                      <span>{c.label}</span>
                      <span className="tabular-nums font-medium text-foreground">
                        {formatMoney(parsed.totalsByCategory[c.id], currency, rates)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium">Nothing to import from this file</p>
              </div>
            )}
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
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="giving-default-month" className="text-xs">
                Month for rows without a date
              </Label>
              <Input
                id="giving-default-month"
                type="month"
                value={defaultMonth}
                onChange={(e) => setDefaultMonth(e.target.value)}
                className="w-44"
              />
            </div>
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
              <Button type="button" disabled={stage !== "preview" || !parsed?.rows.length} onClick={confirmImport}>
                {stage === "importing" ? "Importing…" : "Confirm import"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

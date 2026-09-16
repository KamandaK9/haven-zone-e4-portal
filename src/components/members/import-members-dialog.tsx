"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud, CheckCircle2, X } from "lucide-react";
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

type Stage = "idle" | "dragging" | "picked" | "importing" | "done";

export function ImportMembersDialog({ churchName }: { churchName: string }) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStage("idle");
    setFileName("");
  }

  function pickFile(name: string) {
    setFileName(name);
    setStage("picked");
  }

  function startImport() {
    setStage("importing");
    setTimeout(() => setStage("done"), 1400);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import members</DialogTitle>
          <DialogDescription>
            Bulk-add members to {churchName} from a spreadsheet.
          </DialogDescription>
        </DialogHeader>

        {stage === "done" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="rounded-full bg-emerald-100 p-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium">Import complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {fileName} was processed (simulated — no rows were actually added).
              </p>
            </div>
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
              pickFile(file?.name ?? "members.xlsx");
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
              onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0].name)}
            />
            {stage === "picked" || stage === "importing" ? (
              <>
                <FileSpreadsheet className="h-8 w-8 text-primary" />
                <p className="text-sm font-medium">{fileName}</p>
                {stage === "importing" && (
                  <p className="text-xs text-muted-foreground">Processing rows…</p>
                )}
                {stage === "picked" && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" /> remove
                  </button>
                )}
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

        <DialogFooter>
          {stage === "done" ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={stage !== "picked"}
                onClick={startImport}
              >
                {stage === "importing" ? "Importing…" : "Import members"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

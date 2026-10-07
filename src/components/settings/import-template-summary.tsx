"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { clearImportTemplate } from "@/lib/actions/member-fields";

// The saved column choices, as "Spreadsheet column → becomes", with a way
// to forget them.
export function ImportTemplateSummary({ rows }: { rows: { column: string; target: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="divide-y rounded-xl border text-sm">
        {rows.map((r) => (
          <div key={r.column} className="flex justify-between gap-3 px-4 py-2">
            <span className="truncate text-muted-foreground">{r.column}</span>
            <span className={r.target === "Not imported" ? "text-muted-foreground" : "font-medium"}>{r.target}</span>
          </div>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await clearImportTemplate();
            if (!result.ok) return setError(result.error);
            router.refresh();
          })
        }
      >
        {pending ? "Forgetting…" : "Forget saved columns"}
      </Button>
    </div>
  );
}

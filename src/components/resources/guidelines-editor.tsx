"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveLogoGuidelines } from "@/lib/actions/resources";

// One guideline per line.
export function GuidelinesEditor({ text, editable }: { text: string; editable: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [busy, setBusy] = useState(false);
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
        <p className="text-xs text-muted-foreground">One guideline per line. Leave it empty to go back to the defaults.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await saveLogoGuidelines(draft);
              setBusy(false);
              setEditing(false);
              router.refresh();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <ul className="list-disc space-y-1.5 pl-5 text-sm">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {editable && (
        <Button variant="outline" size="sm" onClick={() => { setDraft(text); setEditing(true); }}>
          Edit guidelines
        </Button>
      )}
    </div>
  );
}

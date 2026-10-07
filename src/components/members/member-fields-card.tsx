"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setMemberFieldValues } from "@/lib/actions/member-fields";
import { displayFieldValue, type MemberField } from "@/lib/custom-fields";

export type MemberFieldEntry = { field: MemberField; value?: string; editable: boolean };

const NONE = "__none";

// The organisation's own details about one person. Shows the ones the viewer
// may see; edits the ones they may change (the database checks both).
export function MemberFieldsCard({
  memberId,
  entries,
  title = "More details",
  description,
}: {
  memberId: string;
  entries: MemberFieldEntry[];
  title?: string;
  description?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canEdit = entries.some((e) => e.editable);
  if (entries.length === 0) return null;

  function begin() {
    setDraft(Object.fromEntries(entries.filter((e) => e.editable).map((e) => [e.field.id, e.value ?? ""])));
    setError(null);
    setEditing(true);
  }

  function save() {
    const changed: Record<string, string | null> = {};
    for (const e of entries) {
      if (!e.editable) continue;
      const next = (draft[e.field.id] ?? "").trim();
      if (next !== (e.value ?? "")) changed[e.field.id] = next || null;
    }
    start(async () => {
      const result = await setMemberFieldValues(memberId, changed);
      if (!result.ok) return setError(result.error);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={begin}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map(({ field, value, editable }) => (
            <div key={field.id} className="space-y-1">
              <p className="text-xs text-muted-foreground">{field.label}</p>
              {editing && editable ? (
                <FieldInput
                  field={field}
                  value={draft[field.id] ?? ""}
                  onChange={(v) => setDraft((d) => ({ ...d, [field.id]: v }))}
                />
              ) : (
                <p className="text-sm font-medium">{displayFieldValue(field, value)}</p>
              )}
            </div>
          ))}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {editing && (
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FieldInput({ field, value, onChange }: { field: MemberField; value: string; onChange: (v: string) => void }) {
  if (field.type === "select" || field.type === "yes_no") {
    const options = field.type === "yes_no" ? [{ v: "yes", l: "Yes" }, { v: "no", l: "No" }] : field.options.map((o) => ({ v: o, l: o }));
    return (
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger className="w-full" aria-label={field.label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      aria-label={field.label}
      type={field.type === "date" ? "date" : "text"}
      inputMode={field.type === "number" ? "decimal" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

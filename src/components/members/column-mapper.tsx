"use client";

import { useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createMemberField } from "@/lib/actions/member-fields";
import { distinctOptions, FIELD_TYPES, FIELD_VISIBILITY, guessFieldType, type MemberField } from "@/lib/custom-fields";
import { BUILTIN_TARGETS, type ImportColumn } from "@/lib/import/column-mapping";
import type { ColumnMapping } from "@/lib/import/parse-members";
import type { MemberFieldType, MemberFieldVisibility } from "@/lib/supabase/types";
import { tenant } from "@/tenant";

const NEW = "__new";

function builtinLabel(field: string, label: string): string {
  if (field === "cellName") return tenant.labels.cell;
  return label;
}

// One row per spreadsheet column: what it becomes — skipped, a built-in
// member detail, one of the organisation's own fields, or (for admins) a new
// field made from it right here.
export function ColumnMapper({
  columns,
  mapping,
  onChange,
  fields,
  onFieldCreated,
  canCreateFields,
}: {
  columns: ImportColumn[];
  mapping: ColumnMapping;
  onChange: (mapping: ColumnMapping) => void;
  fields: MemberField[];
  onFieldCreated: (field: MemberField) => void;
  canCreateFields: boolean;
}) {
  const [creating, setCreating] = useState<string | null>(null);
  const live = fields.filter((f) => !f.archived);
  const hasAgeGroups = (tenant.ageGroups?.length ?? 0) > 0;
  const builtins = BUILTIN_TARGETS.filter((t) => t.field !== "ageGroup" || hasAgeGroups);
  const usedBuiltins = new Set(Object.values(mapping).filter((v) => v.startsWith("builtin:")));

  return (
    <div className="max-h-[55vh] divide-y overflow-y-auto rounded-xl border">
      {columns.map((col) => {
        const target = mapping[col.key] ?? "skip";
        return (
          <div key={col.key} className="space-y-2 p-3">
            <div className="grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{col.header}</p>
                <p className="truncate text-xs text-muted-foreground">{col.samples.length ? col.samples.slice(0, 3).join(" · ") : "(empty)"}</p>
              </div>
              <ArrowRight className="hidden h-4 w-4 text-muted-foreground sm:block" />
              <Select
                value={target}
                onValueChange={(v) => {
                  if (v === NEW) return setCreating(col.key);
                  onChange({ ...mapping, [col.key]: v });
                }}
              >
                <SelectTrigger className={target === "skip" ? "w-full text-muted-foreground" : "w-full"} aria-label={`What "${col.header}" is`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Don&apos;t import</SelectItem>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel>Member details</SelectLabel>
                    {builtins.map((b) => {
                      const value = `builtin:${b.field}`;
                      return (
                        <SelectItem key={value} value={value} disabled={usedBuiltins.has(value) && target !== value}>
                          {builtinLabel(b.field, b.label)}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                  {live.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Your fields</SelectLabel>
                        {live.map((f) => (
                          <SelectItem key={f.id} value={`custom:${f.key}`}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                  {canCreateFields && (
                    <>
                      <SelectSeparator />
                      <SelectItem value={NEW}>+ New field from this column…</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {creating === col.key && (
              <NewFieldForm
                column={col}
                onCancel={() => setCreating(null)}
                onCreated={(field) => {
                  onFieldCreated(field);
                  onChange({ ...mapping, [col.key]: `custom:${field.key}` });
                  setCreating(null);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function NewFieldForm({ column, onCancel, onCreated }: { column: ImportColumn; onCancel: () => void; onCreated: (f: MemberField) => void }) {
  const guessed = guessFieldType(column.samples);
  const [label, setLabel] = useState(column.header);
  const [type, setType] = useState<MemberFieldType>(guessed);
  const [options, setOptions] = useState(distinctOptions(column.samples).join(", "));
  const [visibility, setVisibility] = useState<MemberFieldVisibility>("leaders");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const result = await createMemberField({
      label,
      type,
      options: options.split(",").map((o) => o.trim()).filter(Boolean),
      visibility,
      memberAccess: "hidden",
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onCreated(result.field);
  }

  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      <p className="text-xs font-medium">New member field</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input aria-label="Field name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name" />
        <Select value={type} onValueChange={(v) => setType(v as MemberFieldType)}>
          <SelectTrigger className="w-full" aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={visibility} onValueChange={(v) => setVisibility(v as MemberFieldVisibility)}>
          <SelectTrigger className="w-full" aria-label="Who can see it">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_VISIBILITY.map((v) => (
              <SelectItem key={v.value} value={v.value}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {type === "select" && (
        <Input aria-label="Options" value={options} onChange={(e) => setOptions(e.target.value)} placeholder="Options, separated by commas" />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={create} disabled={busy || !label.trim()} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> {busy ? "Adding…" : "Add field"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

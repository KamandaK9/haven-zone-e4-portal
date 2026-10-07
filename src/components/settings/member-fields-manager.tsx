"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createMemberField, updateMemberField } from "@/lib/actions/member-fields";
import { FIELD_MEMBER_ACCESS, FIELD_TYPES, FIELD_VISIBILITY, type MemberField } from "@/lib/custom-fields";
import type { MemberFieldAccess, MemberFieldType, MemberFieldVisibility } from "@/lib/supabase/types";

const typeLabel = (t: MemberFieldType) => FIELD_TYPES.find((x) => x.value === t)?.label ?? t;
const visibilityLabel = (v: MemberFieldVisibility) => FIELD_VISIBILITY.find((x) => x.value === v)?.label ?? v;
const accessLabel = (a: MemberFieldAccess) => FIELD_MEMBER_ACCESS.find((x) => x.value === a)?.label ?? a;

type Draft = { label: string; type: MemberFieldType; options: string; visibility: MemberFieldVisibility; memberAccess: MemberFieldAccess };

const EMPTY: Draft = { label: "", type: "text", options: "", visibility: "leaders", memberAccess: "hidden" };

// Settings → Member fields: the organisation's own extra details about
// people, and who may see each one.
export function MemberFieldsManager({ fields }: { fields: MemberField[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const live = fields.filter((f) => !f.archived);
  const archived = fields.filter((f) => f.archived);

  return (
    <div className="space-y-4">
      <div className="divide-y rounded-xl border">
        {live.length === 0 && !adding && (
          <p className="p-4 text-sm text-muted-foreground">No fields yet. Add one here, or while importing a spreadsheet.</p>
        )}
        {live.map((f) =>
          editing === f.id ? (
            <div key={f.id} className="p-4">
              <FieldForm field={f} onDone={() => setEditing(null)} />
            </div>
          ) : (
            <FieldRow key={f.id} field={f} onEdit={() => setEditing(f.id)} />
          )
        )}
        {adding && (
          <div className="p-4">
            <FieldForm onDone={() => setAdding(false)} />
          </div>
        )}
      </div>
      {!adding && (
        <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add a field
        </Button>
      )}

      {archived.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Archived — hidden everywhere, values kept</p>
          <div className="divide-y rounded-xl border">
            {archived.map((f) => (
              <FieldRow key={f.id} field={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ field, onEdit }: { field: MemberField; onEdit?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleArchived() {
    start(async () => {
      const result = await updateMemberField(field.id, { ...field, archived: !field.archived });
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{field.label}</p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">{typeLabel(field.type)}</Badge>
          <Badge variant={field.visibility === "admins" ? "destructive" : "outline"}>{visibilityLabel(field.visibility)}</Badge>
          <Badge variant="outline">{accessLabel(field.memberAccess)}</Badge>
        </div>
        {field.type === "select" && <p className="text-xs text-muted-foreground">{field.options.join(" · ")}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      {onEdit && (
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      )}
      <Button size="sm" variant="ghost" className="gap-1.5" disabled={pending} onClick={toggleArchived}>
        {field.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
        {field.archived ? "Restore" : "Archive"}
      </Button>
    </div>
  );
}

function FieldForm({ field, onDone }: { field?: MemberField; onDone: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(
    field
      ? { label: field.label, type: field.type, options: field.options.join(", "), visibility: field.visibility, memberAccess: field.memberAccess }
      : EMPTY
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function save() {
    setError(null);
    start(async () => {
      const options = draft.options.split(",").map((o) => o.trim()).filter(Boolean);
      const input = { label: draft.label, options, visibility: draft.visibility, memberAccess: draft.memberAccess };
      const result = field
        ? await updateMemberField(field.id, { ...input, archived: false })
        : await createMemberField({ ...input, type: draft.type });
      if (!result.ok) return setError(result.error);
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Name</span>
          <Input value={draft.label} onChange={(e) => set("label", e.target.value)} placeholder="e.g. Baptism date" autoFocus />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Type</span>
          <Select value={draft.type} onValueChange={(v) => set("type", v as MemberFieldType)} disabled={!!field}>
            <SelectTrigger className="w-full">
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
          {field && <span className="block text-xs text-muted-foreground">The type can&apos;t change once a field exists.</span>}
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Which leaders see it</span>
          <Select value={draft.visibility} onValueChange={(v) => set("visibility", v as MemberFieldVisibility)}>
            <SelectTrigger className="w-full">
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
          <span className="block text-xs text-muted-foreground">{FIELD_VISIBILITY.find((v) => v.value === draft.visibility)?.hint}</span>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">The member themselves</span>
          <Select value={draft.memberAccess} onValueChange={(v) => set("memberAccess", v as MemberFieldAccess)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_MEMBER_ACCESS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      {draft.type === "select" && (
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Options</span>
          <Input value={draft.options} onChange={(e) => set("options", e.target.value)} placeholder="Separated by commas" />
        </label>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={pending || !draft.label.trim()}>
          {pending ? "Saving…" : field ? "Save" : "Add field"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarDays, MapPin, Pencil, Plus, Search, Trash2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCell, deleteCell, setCellMembers, updateCell, type CellInput } from "@/lib/actions/cells";
import { buildCellTree, totalMembers, type CellNode } from "@/lib/records/cells";
import type { Cell } from "@/lib/data/types";
import { pluralize } from "@/lib/utils";

export type CellMember = { id: string; name: string; cellId?: string };
export type CellLevels = { upper: string; upperPlural: string; lower: string; lowerPlural: string };

const NONE = "__none";

function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {error}
    </div>
  );
}

function CellDialog({
  open,
  onOpenChange,
  churchId,
  cell,
  parentId,
  groups,
  members,
  levels,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  churchId: string;
  // Editing when set; otherwise adding (a cell under parentId, or a group).
  cell?: Cell;
  parentId?: string;
  groups: Cell[];
  members: CellMember[];
  levels: CellLevels;
}) {
  const router = useRouter();
  const initial: CellInput = {
    name: cell?.name ?? "",
    parentId: cell ? (cell.parentId ?? null) : (parentId ?? null),
    leaderMemberId: cell?.leaderMemberId ?? null,
    meetingDay: cell?.meetingDay ?? "",
    meetingPlace: cell?.meetingPlace ?? "",
  };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCell = !!form.parentId;
  const noun = isCell ? levels.lower : levels.upper;

  async function save() {
    setBusy(true);
    setError(null);
    const result = cell ? await updateCell(cell.id, form) : await createCell(churchId, form);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setForm(initial);
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{cell ? `Edit ${noun.toLowerCase()}` : `Add a ${noun.toLowerCase()}`}</DialogTitle>
          <DialogDescription>
            {isCell ? `A ${levels.lower.toLowerCase()} sits within a ${levels.upper.toLowerCase()}.` : `A ${levels.upper.toLowerCase()} groups several ${levels.lowerPlural.toLowerCase()}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="cell-name">Name</Label>
            <Input id="cell-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          {(cell?.parentId || parentId || (cell && groups.length > 0)) && (
            <div className="space-y-1.5">
              <Label>Part of</Label>
              <Select value={form.parentId ?? NONE} onValueChange={(v) => setForm({ ...form, parentId: v === NONE ? null : v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nothing — it&apos;s a {levels.upper.toLowerCase()}</SelectItem>
                  {groups
                    .filter((g) => g.id !== cell?.id)
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Leader</Label>
            <Select value={form.leaderMemberId ?? NONE} onValueChange={(v) => setForm({ ...form, leaderMemberId: v === NONE ? null : v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No leader yet</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cell-day">Meets</Label>
              <Input id="cell-day" placeholder="e.g. Tuesdays 18:00" value={form.meetingDay} onChange={(e) => setForm({ ...form, meetingDay: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cell-place">Where</Label>
              <Input id="cell-place" placeholder="e.g. 12 Main Rd" value={form.meetingPlace} onChange={(e) => setForm({ ...form, meetingPlace: e.target.value })} />
            </div>
          </div>
          <ErrorNote error={error} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={busy || !form.name.trim()}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignMembersDialog({
  open,
  onOpenChange,
  cell,
  members,
  cellNames,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cell: Cell;
  members: CellMember[];
  cellNames: Map<string, string>;
}) {
  const router = useRouter();
  const current = () => new Set(members.filter((m) => m.cellId === cell.id).map((m) => m.id));
  const [selected, setSelected] = useState<Set<string>>(current);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = members.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()));

  async function save() {
    setBusy(true);
    setError(null);
    const result = await setCellMembers(cell.id, [...selected]);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setSelected(current());
          setQuery("");
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Members of {cell.name}</DialogTitle>
          <DialogDescription>Tick who belongs here. Someone already in another group moves across.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search members…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
          </div>
          <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
            {shown.map((m) => {
              const elsewhere = m.cellId && m.cellId !== cell.id ? cellNames.get(m.cellId) : undefined;
              return (
                <li key={m.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={selected.has(m.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (v === true) next.add(m.id);
                          else next.delete(m.id);
                          return next;
                        })
                      }
                    />
                    <span className="flex-1">{m.name}</span>
                    {elsewhere && <span className="text-xs text-muted-foreground">in {elsewhere}</span>}
                  </label>
                </li>
              );
            })}
            {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">No members match.</li>}
          </ul>
          <p className="text-xs text-muted-foreground">{pluralize(selected.size, "member")} selected</p>
          <ErrorNote error={error} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DialogState =
  | { type: "add"; parentId?: string }
  | { type: "edit"; cell: Cell }
  | { type: "members"; cell: Cell }
  | { type: "delete"; cell: Cell }
  | null;

export function CellsDirectory({
  churchId,
  cells,
  members,
  canManage,
  levels,
}: {
  churchId: string;
  cells: Cell[];
  members: CellMember[];
  canManage: boolean;
  levels: CellLevels;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => buildCellTree(cells, members.map((m) => m.cellId)), [cells, members]);
  const names = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
  const cellNames = useMemo(() => new Map(cells.map((c) => [c.id, c.name])), [cells]);
  const groups = cells.filter((c) => !c.parentId);
  const unassigned = members.filter((m) => !m.cellId || !cellNames.has(m.cellId)).length;
  const close = (v: boolean) => !v && setDialog(null);

  async function remove(cell: Cell) {
    setBusy(true);
    setError(null);
    const result = await deleteCell(cell.id);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDialog(null);
    router.refresh();
  }

  function meta(node: CellNode<Cell>) {
    const leader = node.leaderMemberId ? names.get(node.leaderMemberId) : undefined;
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <UserRound className="h-3 w-3" />
          {leader ?? "No leader"}
        </span>
        {node.meetingDay && (
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {node.meetingDay}
          </span>
        )}
        {node.meetingPlace && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {node.meetingPlace}
          </span>
        )}
      </div>
    );
  }

  function actions(cell: Cell) {
    if (!canManage) return null;
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={() => setDialog({ type: "members", cell })}>
          <Users className="h-3.5 w-3.5" />
          Members
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ type: "edit", cell })} aria-label={`Edit ${cell.name}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ type: "delete", cell })} aria-label={`Delete ${cell.name}`}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {pluralize(groups.length, levels.upper.toLowerCase(), levels.upperPlural.toLowerCase())} ·{" "}
          {pluralize(cells.length - groups.length, levels.lower.toLowerCase(), levels.lowerPlural.toLowerCase())}
          {members.length > 0 && ` · ${unassigned} not in any`}
        </p>
        {canManage && (
          <Button size="sm" className="gap-1.5" onClick={() => setDialog({ type: "add" })}>
            <Plus className="h-3.5 w-3.5" />
            Add {levels.upper.toLowerCase()}
          </Button>
        )}
      </div>

      {tree.length === 0 ? (
        <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          No {levels.upperPlural.toLowerCase()} or {levels.lowerPlural.toLowerCase()} recorded for this chapter yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {tree.map((group) => (
            <li key={group.id} className="rounded-xl border">
              <div className="flex items-start gap-3 p-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">
                    {group.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">· {pluralize(totalMembers(group), "member")}</span>
                  </p>
                  {meta(group)}
                </div>
                {actions(group)}
              </div>
              {(group.children.length > 0 || canManage) && (
                <ul className="divide-y border-t bg-muted/20">
                  {group.children.map((cell) => (
                    <li key={cell.id} className="flex items-start gap-3 py-2.5 pl-6 pr-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium">
                          {cell.name} <span className="text-xs font-normal text-muted-foreground">· {pluralize(cell.memberCount, "member")}</span>
                        </p>
                        {meta(cell)}
                      </div>
                      {actions(cell)}
                    </li>
                  ))}
                  {canManage && (
                    <li className="py-1.5 pl-5">
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setDialog({ type: "add", parentId: group.id })}>
                        <Plus className="h-3 w-3" />
                        Add {levels.lower.toLowerCase()}
                      </Button>
                    </li>
                  )}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {dialog?.type === "add" || dialog?.type === "edit" ? (
        <CellDialog
          key={dialog.type === "edit" ? dialog.cell.id : `add-${dialog.parentId ?? ""}`}
          open
          onOpenChange={close}
          churchId={churchId}
          cell={dialog.type === "edit" ? dialog.cell : undefined}
          parentId={dialog.type === "add" ? dialog.parentId : undefined}
          groups={groups}
          members={members}
          levels={levels}
        />
      ) : null}
      {dialog?.type === "members" && (
        <AssignMembersDialog key={dialog.cell.id} open onOpenChange={close} cell={dialog.cell} members={members} cellNames={cellNames} />
      )}
      {dialog?.type === "delete" && (
        <Dialog open onOpenChange={close}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete {dialog.cell.name}?</DialogTitle>
              <DialogDescription>
                {dialog.cell.parentId
                  ? "Its members stay in the chapter, just not in any cell."
                  : `Its ${levels.lowerPlural.toLowerCase()} are deleted too. Their members stay in the chapter, just unassigned.`}
              </DialogDescription>
            </DialogHeader>
            <ErrorNote error={error} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => remove(dialog.cell)} disabled={busy}>
                {busy ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search, ShieldCheck, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { assignRoleToMany } from "@/lib/actions/access";
import { cn } from "@/lib/utils";
import type { RoleOption } from "@/components/members/role-card";
import { MemberAvatar } from "@/components/members/member-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddMemberDialog } from "./add-member-dialog";
import { ImportMembersDialog } from "./import-members-dialog";
import type { MemberField } from "@/lib/custom-fields";
import type { ColumnMapping } from "@/lib/import/parse-members";
import { formatTenure, memberFullName, memberTenureYears, memberTotalGiving } from "@/lib/data/analytics";
import { canActOn, isLeader, positionLabel, type Position } from "@/lib/access";
import type { Member, MemberRole } from "@/lib/data/types";
import { MEMBER_STATUSES } from "@/lib/statuses";
import { tenant } from "@/tenant";

const ROLES: (MemberRole | "All roles")[] = ["All roles", ...MEMBER_STATUSES];
const AGE_GROUPS = tenant.ageGroups ?? [];
const ageGroupLabel = (key?: string) => AGE_GROUPS.find((g) => g.key === key)?.label;

const NO_DEPARTMENTS: { id: string; name: string }[] = [];
const NO_MEMBERSHIPS: Record<string, string[]> = {};

export function MemberTable({
  members,
  churchId,
  countryId,
  churchName,
  showGiving = true,
  canManage = true,
  cellNames,
  importFields,
  importTemplate,
  canManageSettings,
  departments = NO_DEPARTMENTS,
  memberDepartments = NO_MEMBERSHIPS,
  roleOptions,
  actor,
}: {
  // The roles the viewer may give, and who they are — when set, rows get
  // checkboxes and a selection can be given a role in one go.
  roleOptions?: RoleOption[];
  actor?: { position: Position; userId: string };
  // Cell id → name; the Cell column only shows when the chapter has cells.
  cellNames?: Record<string, string>;
  // The organisation's departments and who is in which; the column and
  // filter only show when there are departments.
  departments?: { id: string; name: string }[];
  memberDepartments?: Record<string, string[]>;
  showGiving?: boolean;
  canManage?: boolean;
  members: Member[];
  churchId: string;
  countryId: string;
  churchName: string;
  importFields?: MemberField[];
  importTemplate?: ColumnMapping | null;
  canManageSettings?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("All roles");
  const [ageGroup, setAgeGroup] = useState("all");
  const [department, setDepartment] = useState("all");
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [roleOpen, setRoleOpen] = useState(false);
  const [picked, setPicked] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ done: number; failed: { name: string; error: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bulk = !!roleOptions && roleOptions.length > 0 && !!actor;
  // Only people the viewer may change: below their rank, and not themselves.
  const changeable = (m: Member) => bulk && m.profileId !== actor!.userId && canActOn(actor!.position, m.position);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesQuery =
        query.trim() === "" ||
        memberFullName(m).toLowerCase().includes(query.toLowerCase()) ||
        m.email.toLowerCase().includes(query.toLowerCase());
      const matchesRole = role === "All roles" || m.role === role;
      const matchesAgeGroup = ageGroup === "all" || (ageGroup === "none" ? !ageGroupLabel(m.ageGroup) : m.ageGroup === ageGroup);
      const inDepartments = memberDepartments[m.id] ?? [];
      const matchesDepartment = department === "all" || (department === "none" ? inDepartments.length === 0 : inDepartments.includes(department));
      return matchesQuery && matchesRole && matchesAgeGroup && matchesDepartment;
    });
  }, [members, query, role, ageGroup, department, memberDepartments]);

  const ageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      const key = ageGroupLabel(m.ageGroup) ? (m.ageGroup as string) : "none";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [members]);
  const selectable = filtered.filter(changeable);
  const allSelected = selectable.length > 0 && selectable.every((m) => selected.has(m.id));
  const someSelected = selectable.some((m) => selected.has(m.id));
  const chosen = members.filter((m) => selected.has(m.id) && changeable(m));

  function toggle(id: string, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function giveRole() {
    setBusy(true);
    setError(null);
    const res = await assignRoleToMany({ memberIds: chosen.map((m) => m.id), position: picked as Position });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOutcome({ done: res.done, failed: res.failed });
    setSelected(new Set(res.failed.length ? chosen.filter((m) => res.failed.some((f) => f.name === memberFullName(m))).map((m) => m.id) : []));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {AGE_GROUPS.length > 0 && (
        <nav aria-label="Age groups" className="-mx-1 overflow-x-auto border-b">
          <ul className="flex min-w-max gap-1 px-1">
            {[
              { key: "all", label: "Everyone", count: members.length },
              ...AGE_GROUPS.map((g) => ({ key: g.key, label: g.label, count: ageCounts.get(g.key) ?? 0 })),
              ...((ageCounts.get("none") ?? 0) > 0 ? [{ key: "none", label: "No age group", count: ageCounts.get("none") ?? 0 }] : []),
            ].map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => setAgeGroup(t.key)}
                  aria-current={ageGroup === t.key ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    ageGroup === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label} <span className="text-xs font-normal text-muted-foreground">{t.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search members…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as (typeof ROLES)[number])}>
            <SelectTrigger className="w-[140px] shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {departments.length > 0 && (
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-[150px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
                <SelectItem value="none">No department</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        {canManage && (
          <div className="flex gap-2 shrink-0">
            <ImportMembersDialog
              churchName={churchName}
              churchId={churchId}
              countryId={countryId}
              fields={importFields}
              template={importTemplate}
              canManageSettings={canManageSettings}
            />
            <AddMemberDialog churchId={churchId} countryId={countryId} />
          </div>
        )}
      </div>

      {bulk && selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5">
          <p className="text-sm font-medium">
            {chosen.length} selected
            {chosen.length < selected.size && <span className="font-normal text-muted-foreground"> · {selected.size - chosen.length} you can&apos;t change</span>}
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1.5" disabled={chosen.length === 0} onClick={() => { setPicked(""); setError(null); setOutcome(null); setRoleOpen(true); }}>
              <ShieldCheck className="h-3.5 w-3.5" /> Give a role
            </Button>
            <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {bulk && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select everyone shown"
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        for (const m of selectable) {
                          if (v === true) next.add(m.id);
                          else next.delete(m.id);
                        }
                        return next;
                      })
                    }
                    disabled={selectable.length === 0}
                  />
                </TableHead>
              )}
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              {AGE_GROUPS.length > 0 && <TableHead>Age group</TableHead>}
              {departments.length > 0 && <TableHead>Departments</TableHead>}
              {cellNames && <TableHead>Cell</TableHead>}
              <TableHead>Tenure</TableHead>
              <TableHead>Training</TableHead>
              {showGiving && <TableHead className="text-right">Total giving</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((member) => {
              const completed = member.trainings.filter((t) => t.status === "completed").length;
              return (
                <TableRow key={member.id} data-state={selected.has(member.id) ? "selected" : undefined}>
                  {bulk && (
                    <TableCell className="w-10">
                      <Checkbox
                        aria-label={`Select ${memberFullName(member)}`}
                        checked={selected.has(member.id)}
                        disabled={!changeable(member)}
                        onCheckedChange={(v) => toggle(member.id, v === true)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link href={`/members/${member.id}`} className="flex items-center gap-2.5 group">
                      <MemberAvatar
                        firstName={member.firstName}
                        lastName={member.lastName}
                        avatarColor={member.avatarColor}
                        photoUrl={member.photoUrl}
                        className="h-8 w-8 text-xs"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                          {memberFullName(member)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {isLeader(member.position) ? positionLabel(member.position) : member.role}
                    </Badge>
                  </TableCell>
                  {AGE_GROUPS.length > 0 && (
                    <TableCell className="text-sm text-muted-foreground">{ageGroupLabel(member.ageGroup) ?? "—"}</TableCell>
                  )}
                  {departments.length > 0 && (
                    <TableCell className="text-sm text-muted-foreground">
                      {(memberDepartments[member.id] ?? []).map((id) => departmentName.get(id)).filter(Boolean).join(", ") || "—"}
                    </TableCell>
                  )}
                  {cellNames && (
                    <TableCell className="text-sm text-muted-foreground">
                      {(member.cellId && cellNames[member.cellId]) || "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-sm text-muted-foreground">
                    {formatTenure(memberTenureYears(member))}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {completed}/{member.trainings.length} complete
                    </span>
                  </TableCell>
                  {showGiving && (
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      ${memberTotalGiving(member).toLocaleString()}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={(bulk ? 1 : 0) + (showGiving ? 5 : 4) + (cellNames ? 1 : 0) + (AGE_GROUPS.length > 0 ? 1 : 0) + (departments.length > 0 ? 1 : 0)} className="text-center text-sm text-muted-foreground py-10">
                  No members match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Give a role to {chosen.length} {chosen.length === 1 ? "person" : "people"}</DialogTitle>
            <DialogDescription>You can give roles below your own. Anyone you can&apos;t change is skipped and listed afterwards.</DialogDescription>
          </DialogHeader>
          {outcome ? (
            <div className="space-y-2 py-2 text-sm">
              <p className="font-medium">{outcome.done} updated{outcome.failed.length > 0 && `, ${outcome.failed.length} not changed`}.</p>
              {outcome.failed.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-red-700">
                  {outcome.failed.map((f) => (
                    <li key={f.name}>{f.name}: {f.error}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto py-1">
              {(roleOptions ?? []).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setPicked(o.key)}
                  className={cn("w-full rounded-lg border p-3 text-left transition-colors", picked === o.key ? "border-primary bg-primary/5" : "hover:bg-muted/50")}
                >
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {picked === o.key && <Check className="h-4 w-4 text-primary" />}
                    {o.label}
                  </p>
                  {o.description && <p className="mt-0.5 text-xs text-muted-foreground">{o.description}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">Sees {o.sees}</p>
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleOpen(false)}>{outcome ? "Close" : "Cancel"}</Button>
            {!outcome && (
              <Button onClick={giveRole} disabled={busy || !picked}>
                {busy ? "Saving…" : `Give to ${chosen.length}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { isLeader, positionLabel } from "@/lib/access";
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
}: {
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

  return (
    <div className="space-y-4">
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
          {AGE_GROUPS.length > 0 && (
            <Select value={ageGroup} onValueChange={setAgeGroup}>
              <SelectTrigger className="w-[140px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ages</SelectItem>
                {AGE_GROUPS.map((g) => (
                  <SelectItem key={g.key} value={g.key}>
                    {g.label}
                  </SelectItem>
                ))}
                <SelectItem value="none">No age group</SelectItem>
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

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableRow key={member.id}>
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
                <TableCell colSpan={(showGiving ? 5 : 4) + (cellNames ? 1 : 0) + (AGE_GROUPS.length > 0 ? 1 : 0) + (departments.length > 0 ? 1 : 0)} className="text-center text-sm text-muted-foreground py-10">
                  No members match your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { memberFullName, memberTenureYears, memberTotalGiving } from "@/lib/data/analytics";
import { useZone } from "@/lib/data/zone-context";
import type { Member, MemberRole } from "@/lib/data/types";

const ROLES: (MemberRole | "All roles")[] = ["All roles", "Member", "Worker", "Cell Leader", "Pastor"];

export function MemberTable({
  members,
  churchId,
  countryId,
  churchName,
}: {
  members: Member[];
  churchId: string;
  countryId: string;
  churchName: string;
}) {
  const { addMember } = useZone();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("All roles");

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchesQuery =
        query.trim() === "" ||
        memberFullName(m).toLowerCase().includes(query.toLowerCase()) ||
        m.email.toLowerCase().includes(query.toLowerCase());
      const matchesRole = role === "All roles" || m.role === role;
      return matchesQuery && matchesRole;
    });
  }, [members, query, role]);

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
        </div>
        <div className="flex gap-2 shrink-0">
          <ImportMembersDialog churchName={churchName} />
          <AddMemberDialog
            churchId={churchId}
            countryId={countryId}
            onAdd={addMember}
          />
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Tenure</TableHead>
              <TableHead>Training</TableHead>
              <TableHead className="text-right">Total giving</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((member) => {
              const completed = member.trainings.filter((t) => t.status === "completed").length;
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <Link href={`/members/${member.id}`} className="flex items-center gap-2.5 group">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback
                          className="text-xs font-semibold text-white"
                          style={{ backgroundColor: member.avatarColor }}
                        >
                          {member.firstName[0]}
                          {member.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
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
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {memberTenureYears(member) < 0.1
                      ? "New"
                      : `${memberTenureYears(member).toFixed(1)} yrs`}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {completed}/{member.trainings.length} complete
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold tabular-nums">
                    ${memberTotalGiving(member).toLocaleString()}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
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

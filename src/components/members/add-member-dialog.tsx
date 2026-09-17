"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Member, MemberRole } from "@/lib/data/types";

const ROLES: MemberRole[] = ["Member", "Worker", "Cell Leader", "Pastor"];
const AVATAR_COLORS = ["#7c3aed", "#a21caf", "#9333ea", "#be185d", "#6d28d9", "#c026d3", "#8b5cf6"];

export function AddMemberDialog({
  churchId,
  countryId,
  onAdd,
}: {
  churchId: string;
  countryId: string;
  onAdd: (member: Member) => void;
}) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<MemberRole>("Member");

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setRole("Member");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName) return;
    const id = `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const member: Member = {
      id,
      firstName,
      lastName,
      email: email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@havenmail.org`,
      phone: phone || "+260 000000000",
      churchId,
      countryId,
      joinDate: new Date().toISOString().slice(0, 10),
      role,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      giving: [],
      trainings: [
        { name: "New Believers Class", status: "not_started" },
        { name: "Foundation School", status: "not_started" },
        { name: "Leadership Development", status: "not_started" },
        { name: "Water Baptism", status: "not_started" },
      ],
    };
    onAdd(member);
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a new member</DialogTitle>
            <DialogDescription>
              This adds the member to the table for this session. It isn&apos;t saved to a database in this prototype.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
                <SelectTrigger className="w-full">
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add member</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

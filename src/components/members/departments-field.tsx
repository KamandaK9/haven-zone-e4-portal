"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setMemberDepartments } from "@/lib/actions/departments";

export function DepartmentsField({
  memberId,
  firstName,
  departments,
  selected,
  canEdit,
  canDefine,
}: {
  memberId: string;
  firstName: string;
  departments: { id: string; name: string }[];
  selected: string[];
  canEdit: boolean;
  canDefine: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const names = departments.filter((d) => selected.includes(d.id)).map((d) => d.name);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Departments:</span>
      {names.length === 0 ? <span className="text-xs text-muted-foreground">none</span> : names.map((n) => <Badge key={n} variant="secondary">{n}</Badge>)}
      {canEdit && (
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={() => { setPicked(new Set(selected)); setError(null); setOpen(true); }}>
          <Pencil className="h-3 w-3" /> Edit
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Where does {firstName} serve?</DialogTitle>
            <DialogDescription>Departments are labels — they don&apos;t change what anyone can see.</DialogDescription>
          </DialogHeader>
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No departments yet.{" "}
              {canDefine && <Link href="/settings/departments" className="text-primary hover:underline">Add them in Settings</Link>}
            </p>
          ) : (
            <div className="space-y-1">
              {departments.map((d) => (
                <label key={d.id} className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-muted/50">
                  <Checkbox
                    checked={picked.has(d.id)}
                    onCheckedChange={(v) =>
                      setPicked((p) => {
                        const n = new Set(p);
                        if (v) n.add(d.id);
                        else n.delete(d.id);
                        return n;
                      })
                    }
                  />
                  {d.name}
                </label>
              ))}
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={busy || departments.length === 0}
              onClick={async () => {
                setBusy(true);
                const res = await setMemberDepartments(memberId, [...picked]);
                setBusy(false);
                if (!res.ok) return setError(res.error);
                setOpen(false);
                router.refresh();
              }}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

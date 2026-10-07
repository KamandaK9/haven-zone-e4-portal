"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteMember } from "@/lib/actions/member-data";

// POPIA requests on a member: a copy of everything held (access), or
// deleting them and all their records (erasure).
export function MemberDataActions({ memberId, fullName, backHref }: { memberId: string; fullName: string; backHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <a href={`/members/${memberId}/data`}>
          <Download className="h-3.5 w-3.5" /> Download their data
        </a>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          setTyped("");
          setError(null);
        }}
      >
        <Button variant="outline" size="sm" className="gap-1.5 text-red-700 hover:text-red-800" onClick={() => setOpen(true)}>
          <Trash2 className="h-3.5 w-3.5" /> Delete member
        </Button>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {fullName}?</DialogTitle>
            <DialogDescription>
              This removes them and everything recorded about them — attendance, classes, follow-ups, giving and their photo. It
              can&apos;t be undone. Use it when someone asks for their information to be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm">
              Type <span className="font-semibold">{fullName}</span> to confirm.
            </p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || typed.trim().toLowerCase() !== fullName.toLowerCase()}
              onClick={async () => {
                setBusy(true);
                const res = await deleteMember(memberId, typed);
                setBusy(false);
                if (!res.ok) return setError(res.error);
                router.push(backHref);
                router.refresh();
              }}
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

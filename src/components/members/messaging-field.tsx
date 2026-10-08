"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { updateMessagingDetails } from "@/lib/actions/messaging-details";

export function MessagingField({
  memberId,
  firstName,
  guardianName,
  guardianPhone,
  optOut,
  isMinor,
  canEdit,
}: {
  memberId: string;
  firstName: string;
  guardianName?: string;
  guardianPhone?: string;
  optOut: boolean;
  isMinor: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(guardianName ?? "");
  const [phone, setPhone] = useState(guardianPhone ?? "");
  const [out, setOut] = useState(optOut);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = [
    guardianPhone ? `Guardian: ${guardianName ? `${guardianName}, ` : ""}${guardianPhone}` : isMinor ? "No guardian number — can't be messaged" : null,
    optOut ? "Opted out of messages" : null,
  ].filter(Boolean);

  if (!canEdit && summary.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">Messages:</span>
      <span className={isMinor && !guardianPhone ? "text-amber-700" : "text-muted-foreground"}>{summary.join(" · ") || "to their own number"}</span>
      {canEdit && (
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={() => { setName(guardianName ?? ""); setPhone(guardianPhone ?? ""); setOut(optOut); setError(null); setOpen(true); }}>
          <Pencil className="h-3 w-3" /> Edit
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Messages for {firstName}</DialogTitle>
            <DialogDescription>
              {isMinor ? `${firstName} is a minor, so texts go to their guardian — never to them directly.` : "Only needed for children; adults are messaged directly."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label htmlFor="g-name">Guardian&apos;s name</Label>
              <Input id="g-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="g-phone">Guardian&apos;s phone</Label>
              <Input id="g-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <Checkbox checked={out} onCheckedChange={(v) => setOut(!!v)} />
              Opted out — send no messages
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await updateMessagingDetails(memberId, { guardianName: name, guardianPhone: phone, optOut: out });
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

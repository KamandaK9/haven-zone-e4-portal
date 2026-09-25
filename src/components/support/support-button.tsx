"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AlertCircle, CheckCircle2, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitSupportRequest } from "@/lib/actions/support";
import { SUPPORT_CATEGORIES } from "@/lib/support";
import type { SupportCategory } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

// The Help button in every page's top bar, for members and leaders alike.
export function SupportButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<SupportCategory>("question");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(v: boolean) {
    setOpen(v);
    if (v) {
      setCategory("question");
      setMessage("");
      setSent(false);
      setError(null);
    }
  }

  async function send() {
    setBusy(true);
    setError(null);
    const result = await submitSupportRequest({ category, message, pagePath: pathname });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSent(true);
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => reset(true)}>
        <LifeBuoy className="h-4 w-4" />
        <span className="hidden sm:inline">Help</span>
        <span className="sr-only sm:hidden">Get help</span>
      </Button>
      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="sm:max-w-md">
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              <DialogTitle>Thanks — we&apos;ve got it</DialogTitle>
              <DialogDescription>Someone from the office will get back to you by email.</DialogDescription>
              <Button className="mt-2" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>How can we help?</DialogTitle>
                <DialogDescription>Tell us what&apos;s going on and we&apos;ll reply by email.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium">It&apos;s about</legend>
                  <div className="grid gap-1.5">
                    {SUPPORT_CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCategory(c.value)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm",
                          category === c.value ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted"
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="space-y-1.5">
                  <Label htmlFor="support-message">Details</Label>
                  <Textarea
                    id="support-message"
                    rows={5}
                    maxLength={4000}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What were you trying to do, and what happened?"
                  />
                </div>
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {error}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={send} disabled={busy || !message.trim()}>
                  {busy ? "Sending…" : "Send"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

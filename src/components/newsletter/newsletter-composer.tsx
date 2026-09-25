"use client";

import { useState } from "react";
import { Send, CheckCircle2, AlertTriangle, AlertCircle, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getMembersByChurch, getMembersByCountry, type Dataset } from "@/lib/data/analytics";
import { sendNewsletter } from "@/lib/actions/newsletter";

type Outcome = { kind: "sent"; sent: number; skipped: number } | { kind: "not-configured"; error: string } | { kind: "error"; error: string };

export function NewsletterComposer({ ds, zoneName }: { ds: Dataset; zoneName: string }) {
  const [group, setGroup] = useState("zone");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const recipientCount = (() => {
    if (group === "zone") return ds.members.length;
    if (group.startsWith("country:")) return getMembersByCountry(ds, group.split(":")[1]).length;
    if (group.startsWith("church:")) return getMembersByChurch(ds, group.split(":")[1]).length;
    return 0;
  })();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setOutcome(null);
    const result = await sendNewsletter({ group, subject, body });
    setSending(false);
    if (!result.ok) {
      setOutcome({ kind: result.notConfigured ? "not-configured" : "error", error: result.error });
      return;
    }
    setOutcome({ kind: "sent", sent: result.sent, skipped: result.skipped });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Compose message</CardTitle>
          <CardDescription>Sends a real email to everyone in the group below who has an email on file.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="group">Send to</Label>
              <Select value={group} onValueChange={setGroup}>
                <SelectTrigger id="group" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zone">Entire {zoneName}</SelectItem>
                  {ds.countries.map((c) => (
                    <SelectItem key={c.id} value={`country:${c.id}`}>
                      {c.flag} {c.name} — all churches
                    </SelectItem>
                  ))}
                  {ds.churches.map((c) => (
                    <SelectItem key={c.id} value={`church:${c.id}`}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={`e.g. ${zoneName} Leadership Update — September`}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your update…"
                className="min-h-[220px]"
                required
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users2 className="h-4 w-4" />
                {recipientCount.toLocaleString()} in this group
              </div>
              <Button type="submit" className="gap-2" disabled={sending}>
                <Send className="h-4 w-4" />
                {sending ? "Sending…" : "Send newsletter"}
              </Button>
            </div>

            {outcome?.kind === "sent" && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Sent to {outcome.sent.toLocaleString()} recipient{outcome.sent === 1 ? "" : "s"}.
                {outcome.skipped > 0 && ` ${outcome.skipped.toLocaleString()} skipped — no email on file.`}
              </div>
            )}
            {outcome?.kind === "not-configured" && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2.5 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>No email provider is set up yet, so this wasn&apos;t sent. {outcome.error}</span>
              </div>
            )}
            {outcome?.kind === "error" && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2.5 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {outcome.error}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2 min-h-[280px]">
            <p className="text-xs text-muted-foreground">From: {zoneName} Office</p>
            <p className="text-sm font-semibold">{subject || "Your subject line will appear here"}</p>
            <div className="pt-2 text-sm whitespace-pre-wrap text-muted-foreground">
              {body || "Your message preview will appear here as you type."}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

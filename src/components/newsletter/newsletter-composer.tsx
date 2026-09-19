"use client";

import { useState } from "react";
import { Send, CheckCircle2, Users2 } from "lucide-react";
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

export function NewsletterComposer({ ds, zoneName }: { ds: Dataset; zoneName: string }) {
  const [group, setGroup] = useState("zone");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  const recipientCount = (() => {
    if (group === "zone") return ds.members.length;
    if (group.startsWith("country:")) return getMembersByCountry(ds, group.split(":")[1]).length;
    if (group.startsWith("church:")) return getMembersByChurch(ds, group.split(":")[1]).length;
    return 0;
  })();

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  }

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Compose message</CardTitle>
          <CardDescription>This is a UI-only preview — nothing is actually sent.</CardDescription>
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
                {recipientCount.toLocaleString()} recipients
              </div>
              <Button type="submit" className="gap-2">
                <Send className="h-4 w-4" />
                Send newsletter
              </Button>
            </div>

            {sent && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                Sent to {recipientCount.toLocaleString()} recipients (simulated).
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

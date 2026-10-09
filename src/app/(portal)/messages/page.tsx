import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, MessageSquare, Plus, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UsageMeter } from "@/components/messages/usage-meter";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { createClient } from "@/lib/supabase/server";
import { getMessagingSettings, getSmsUsage } from "@/lib/messaging/settings";
import { smsIsConfigured } from "@/lib/messaging/twilio";
import { emailIsConfigured } from "@/lib/email";
import { requireModule } from "@/lib/require-module";
import { STATUS_LABEL } from "@/lib/messaging/labels";

export const metadata = { title: "Messages" };

const KIND_LABEL: Record<string, string> = { manual: "Message", birthday: "Birthdays", welcome: "First-timer welcome", missed: "We missed you" };

export default async function MessagesPage() {
  await requireModule("messaging");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "send_messages") && !can(profile, "approve_messages")) redirect("/dashboard");

  const supabase = await createClient();
  const settings = await getMessagingSettings(profile.zoneId);
  const [usage, { data: rows }] = await Promise.all([
    getSmsUsage(profile.zoneId, settings),
    supabase.from("messages").select("id, kind, channel, subject, body, status, created_by_name, created_at, sent_at, note").order("created_at", { ascending: false }).limit(60),
  ]);
  const messages = rows ?? [];
  const ids = messages.map((m) => m.id);
  const { data: counts } = ids.length ? await supabase.from("message_recipients").select("message_id, status").in("message_id", ids).limit(20000) : { data: [] };
  const total = new Map<string, number>();
  const failed = new Map<string, number>();
  for (const c of counts ?? []) {
    total.set(c.message_id, (total.get(c.message_id) ?? 0) + 1);
    if (c.status === "failed") failed.set(c.message_id, (failed.get(c.message_id) ?? 0) + 1);
  }
  const waiting = messages.filter((m) => m.status === "pending");
  const approves = can(profile, "approve_messages");
  const sms = smsIsConfigured();
  const email = emailIsConfigured();

  const row = (m: (typeof messages)[number]) => (
    <Link key={m.id} href={`/messages/${m.id}`} className="flex items-start justify-between gap-3 p-3 transition-colors hover:bg-muted/50">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {KIND_LABEL[m.kind] ?? "Message"}
          <Badge variant="outline" className="font-normal">{m.channel === "sms" ? "Text" : "Email"}</Badge>
          <Badge variant={STATUS_LABEL[m.status]?.tone ?? "outline"} className="font-normal">{STATUS_LABEL[m.status]?.label ?? m.status}</Badge>
        </p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{m.subject ? `${m.subject} — ` : ""}{m.body}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {m.created_by_name ?? "Automatic"} · {new Date(m.created_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
          {m.note && m.status !== "sent" ? ` · ${m.note}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right text-sm tabular-nums">
        {total.get(m.id) ?? 0} <span className="text-xs text-muted-foreground">people</span>
        {(failed.get(m.id) ?? 0) > 0 && <p className="text-xs text-red-600">{failed.get(m.id)} failed</p>}
      </div>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground">Text or email people. {approves ? "You approve what others send." : "A pastor approves your messages before they go out."}</p>
        </div>
        <div className="flex gap-2">
          {can(profile, "manage_settings") && (
            <Button asChild variant="outline" className="gap-2">
              <Link href="/settings/messaging"><Settings2 className="h-4 w-4" /> Settings</Link>
            </Button>
          )}
          {can(profile, "send_messages") && (
            <Button asChild className="gap-2">
              <Link href="/messages/new"><Plus className="h-4 w-4" /> New message</Link>
            </Button>
          )}
        </div>
      </div>

      {(!sms || !email) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {!sms && !email ? "Texts and email aren't connected yet" : !sms ? "Texts aren't connected yet" : "Email isn't connected yet"} — you can write and approve messages now, and they&apos;ll
            send as soon as the keys are added to the deployment&apos;s settings.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Texts this month</CardTitle>
          <CardDescription>Every text is counted so there are no surprises on the bill.</CardDescription>
        </CardHeader>
        <CardContent>
          <UsageMeter usage={usage} />
        </CardContent>
      </Card>

      {approves && waiting.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Waiting for your approval</CardTitle>
            <CardDescription>Nothing goes out until you approve it.</CardDescription>
          </CardHeader>
          <CardContent className="p-0"><div className="divide-y border-t">{waiting.map(row)}</div></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All messages</CardTitle>
          <CardDescription>Newest first</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {messages.length === 0 ? (
            <p className="p-6 pt-0 text-sm text-muted-foreground">Nothing yet. Start with “New message”.</p>
          ) : (
            <div className="divide-y border-t">{messages.map(row)}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

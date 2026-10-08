import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageActions } from "@/components/messages/message-actions";
import { STATUS_LABEL } from "@/lib/messaging/labels";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { createClient } from "@/lib/supabase/server";
import { requireModule } from "@/lib/require-module";

export const metadata = { title: "Message" };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null);

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("messaging");
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "send_messages") && !can(profile, "approve_messages")) redirect("/dashboard");

  const supabase = await createClient();
  const { data: m } = await supabase.from("messages").select("*").eq("id", id).maybeSingle();
  if (!m) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: "Messages", href: "/messages" }, { label: "Not found" }]} />
        <p className="text-sm text-muted-foreground">This message doesn&apos;t exist, or isn&apos;t yours to see.</p>
      </div>
    );
  }
  const { data: recipients } = await supabase
    .from("message_recipients")
    .select("id, name, to_address, via, status, error, sent_at, segments")
    .eq("message_id", id)
    .order("name")
    .limit(2000);
  const rows = recipients ?? [];
  const sent = rows.filter((r) => r.status === "sent").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const approves = can(profile, "approve_messages");

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Messages", href: "/messages" }, { label: m.kind === "manual" ? "Message" : "Automatic message" }]} />
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{m.subject || (m.channel === "sms" ? "Text message" : "Email")}</h1>
        <Badge variant={STATUS_LABEL[m.status]?.tone ?? "outline"}>{STATUS_LABEL[m.status]?.label ?? m.status}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {m.created_by_name ? `From ${m.created_by_name}` : "Sent automatically"} · {when(m.created_at)}
        {m.approved_by_name && m.status !== "pending" ? ` · ${m.status === "rejected" ? "declined" : "approved"} by ${m.approved_by_name}` : ""}
        {m.sent_at ? ` · sent ${when(m.sent_at)}` : ""}
      </p>
      {m.note && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{m.note}</p>}

      <MessageActions id={m.id} status={m.status} canApprove={approves} canCancel={approves || m.created_by === profile.userId} />

      <Card>
        <CardHeader>
          <CardTitle>The message</CardTitle>
          <CardDescription>Each person&apos;s own name is filled in when it goes out.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm">{m.body}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} {rows.length === 1 ? "person" : "people"}</CardTitle>
          <CardDescription>
            {m.status === "sent" || m.status === "sending" ? `${sent} delivered${failed ? ` · ${failed} failed` : ""}` : "Who it will go to"}
            {m.channel === "sms" ? ` · ${rows.reduce((n, r) => n + r.segments, 0)} texts` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[480px] divide-y overflow-y-auto border-t">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{r.name}{r.via === "guardian" && <span className="text-muted-foreground"> · to their guardian</span>}</p>
                  <p className="text-xs text-muted-foreground">{r.to_address}</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  {r.status === "sent" && <span className="text-emerald-700">Delivered</span>}
                  {r.status === "queued" && <span className="text-muted-foreground">Waiting</span>}
                  {r.status === "failed" && <span className="text-red-700" title={r.error ?? undefined}>Failed</span>}
                  {r.status === "skipped" && <span className="text-muted-foreground">Skipped</span>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Mail } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SupportStatusButton } from "@/components/support/support-status-button";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { emailIsConfigured } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { supportCategoryLabel } from "@/lib/support";
import { cn } from "@/lib/utils";

export default async function SupportInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_access")) redirect("/dashboard");
  const show = (await searchParams).show === "resolved" ? "resolved" : "open";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_requests")
    .select("*")
    .eq("zone_id", profile.zoneId)
    .eq("status", show)
    .order("created_at", { ascending: false })
    .limit(200);
  const emailOn = !!process.env.SUPPORT_EMAIL?.trim() && emailIsConfigured();

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Support requests" }]} />
        <h1 className="text-2xl font-semibold tracking-tight">Support requests</h1>
        <p className="text-sm text-muted-foreground">
          What members and leaders asked through the Help button.{" "}
          {emailOn ? "Each one is also emailed to the support inbox." : "Email isn't set up yet, so they're only kept here — reply using the email link on each."}
        </p>
      </div>

      <nav className="flex gap-1 rounded-xl bg-muted p-1 text-sm" aria-label="Filter">
        {(["open", "resolved"] as const).map((s) => (
          <Link
            key={s}
            href={`/settings/support?show=${s}`}
            className={cn("flex-1 rounded-lg px-3 py-1.5 text-center capitalize", show === s ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}
          >
            {s}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          Support requests aren&apos;t set up in the database yet — apply the latest migration.
        </p>
      ) : data.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {show === "open" ? "Nothing waiting — all caught up." : "No resolved requests yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="space-y-2 rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.requester_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {supportCategoryLabel(r.category)} ·{" "}
                    {new Date(r.created_at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {r.page_path && ` · from ${r.page_path}`}
                    {r.email_status === "failed" && " · email failed"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={`mailto:${r.requester_email}?subject=${encodeURIComponent(`Re: ${supportCategoryLabel(r.category)}`)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Reply
                  </a>
                  <SupportStatusButton requestId={r.id} status={r.status} />
                </div>
              </div>
              <p className="whitespace-pre-line text-sm leading-relaxed">{r.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

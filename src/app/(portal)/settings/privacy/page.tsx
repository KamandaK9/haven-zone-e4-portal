import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Mail } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { DataRequestReply } from "@/components/legal/data-request-reply";
import { LegalSettingsForm } from "@/components/legal/legal-settings-form";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { dataRequestKindLabel, legalGaps } from "@/lib/privacy";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { getLegal } from "@/lib/legal-server";

function daysUntil(iso: string): number {
  return Math.ceil((Date.parse(iso) - Date.now()) / 86_400_000);
}

// The Information Officer's desk: privacy requests with their 30-day
// deadline, plus a reminder of anything unfinished in the privacy setup.
export default async function PrivacyRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_access")) redirect("/dashboard");
  const show = (await searchParams).show === "closed" ? "closed" : "open";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_requests")
    .select("*")
    .eq("zone_id", profile.zoneId)
    .in("status", show === "open" ? ["open", "in_progress"] : ["completed", "declined"])
    .order(show === "open" ? "due_at" : "resolved_at", { ascending: show === "open" })
    .limit(200);
  const legal = await getLegal(profile.zoneId);
  const gaps = legalGaps(legal);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Privacy" }]} />
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="text-sm text-muted-foreground">
          Requests to see, correct or delete personal information, or to object to its use. The law gives 30 days to
          respond. Financial records must be kept for {legal.retention.financial} years even if deletion is asked —
          explain that in your response.
        </p>
      </div>

      {gaps.length > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>Still to fill in before launch: {gaps.join(", ")}.</span>
        </p>
      )}

      <section className="space-y-3 rounded-xl border p-4 sm:p-5">
        <div>
          <h2 className="font-semibold">Privacy details</h2>
          <p className="text-sm text-muted-foreground">
            Who&apos;s responsible and how to reach them — shown in the{" "}
            <Link href="/privacy" className="underline" target="_blank">
              privacy notice
            </Link>{" "}
            and terms. Update it whenever the Information Officer or a provider changes.
          </p>
        </div>
        <LegalSettingsForm key={legal.privacyNoticeVersion + legal.informationOfficer.email} legal={legal} />
      </section>

      <h2 className="pt-2 font-semibold">Requests</h2>

      <nav className="flex gap-1 rounded-xl bg-muted p-1 text-sm" aria-label="Filter">
        {(["open", "closed"] as const).map((s) => (
          <Link key={s} href={`/settings/privacy?show=${s}`} className={cn("flex-1 rounded-lg px-3 py-1.5 text-center capitalize", show === s ? "bg-background font-medium shadow-sm" : "text-muted-foreground")}>
            {s}
          </Link>
        ))}
      </nav>

      {error ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">Privacy requests aren&apos;t set up in the database yet — apply the latest migration.</p>
      ) : data.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{show === "open" ? "No open requests." : "Nothing closed yet."}</p>
      ) : (
        <ul className="space-y-3">
          {data.map((r) => {
            const daysLeft = daysUntil(r.due_at);
            const overdue = show === "open" && daysLeft < 0;
            return (
              <li key={r.id} className={cn("space-y-3 rounded-xl border p-4", overdue && "border-red-500/50")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{dataRequestKindLabel(r.kind)} — {r.requester_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()} ·{" "}
                      {show === "open" ? (
                        <span className={cn(overdue ? "font-medium text-red-600" : daysLeft <= 7 ? "text-amber-600" : "")}>
                          {overdue ? `${-daysLeft} days overdue` : `due in ${daysLeft} days`}
                        </span>
                      ) : (
                        r.status
                      )}
                    </p>
                  </div>
                  <a href={`mailto:${r.requester_email}`} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs hover:bg-muted">
                    <Mail className="h-3.5 w-3.5" /> Email them
                  </a>
                </div>
                <p className="whitespace-pre-line text-sm">{r.details}</p>
                <DataRequestReply id={r.id} status={r.status} response={r.response} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

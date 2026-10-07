import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataRequestForm } from "@/components/legal/data-request-form";
import { LegalFrame } from "@/components/legal/legal-frame";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { dataRequestKindLabel } from "@/lib/privacy";
import { createClient } from "@/lib/supabase/server";
import { tenant } from "@/tenant";

export const metadata: Metadata = { title: "Your data" };

const STATUS: Record<string, string> = { open: "Received", in_progress: "Being handled", completed: "Done", declined: "Declined" };

// Privacy rights in one place, for any signed-in person: download what the
// portal holds about you, and ask for access, correction, deletion or to
// object. Standalone so it works before the privacy notice is accepted.
export default async function MyDataPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/?next=/my-data");
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("data_requests")
    .select("id, kind, details, status, response, created_at, due_at")
    .eq("profile_id", profile.userId)
    .order("created_at", { ascending: false });

  return (
    <LegalFrame title="Your data">
      <Link href={profile.role === "member" ? "/me" : "/dashboard"} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to the portal
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Download your information</CardTitle>
          <CardDescription>Your account, member details, giving, training and messages, as a file you can keep.</CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/api/me/export" className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted">
            <Download className="h-4 w-4" /> Download my data
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Make a privacy request</CardTitle>
          <CardDescription>
            Goes to {tenant.legal.organisationName}&apos;s Information Officer, who must respond within 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataRequestForm />
        </CardContent>
      </Card>

      {requests && requests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your requests</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {requests.map((r) => (
                <li key={r.id} className="space-y-1 py-3 text-sm">
                  <p className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{dataRequestKindLabel(r.kind)}</span>
                    <span className="text-xs text-muted-foreground">
                      {STATUS[r.status] ?? r.status} · sent {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </p>
                  <p className="whitespace-pre-line text-muted-foreground">{r.details}</p>
                  {r.response && <p className="whitespace-pre-line rounded-md bg-muted/50 p-2">{r.response}</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </LegalFrame>
  );
}

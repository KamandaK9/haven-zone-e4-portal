import { redirect } from "next/navigation";
import Link from "next/link";
import { History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NavVisibilityForm } from "@/components/settings/nav-visibility-form";
import { CurrencySelectForm } from "@/components/settings/currency-select-form";
import { restartWizardAction } from "@/lib/actions/auth";
import { can, getCurrentProfile, getAuditLog } from "@/lib/data/get-dataset";

const ACTION_LABELS: Record<string, string> = {
  "member.create": "Added member",
  "member.bulk_import": "Imported members",
  "member.invite_to_portal": "Invited to portal",
  "ledger_entry.create": "Ledger entry",
  "ledger_entry.bulk_import": "Ledger import",
  "training_program.create": "New training program",
  "training_program.update": "Edited training program",
  "training_program.delete": "Deleted training program",
  "access.update": "Access changed",
  "access.recompute": "Permissions refreshed",
  "giving.bulk_import": "Giving import",
  "event.create": "New event edition",
  "event.update": "Edited event page",
  "event.delete": "Deleted event",
  "event.series_update": "Edited event overview",
  "event.media_add": "Added event media",
  "event.media_remove": "Removed event media",
  "event.cover": "Changed event cover",
  "training.assign": "Assigned training",
  "training.update_status": "Training status",
  "settings.update_currency": "Currency changed",
  "church.rename": "Renamed a chapter",
  "member.merge": "Merged duplicate members",
  "member.photo": "Changed a profile photo",
  "training_lesson.create": "Added a lesson",
  "training_lesson.update": "Edited a lesson",
  "training_lesson.delete": "Deleted a lesson",
  "newsletter.send": "Sent a newsletter",
};

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_access")) redirect("/dashboard");

  const auditLog = await getAuditLog(profile.zoneId, 30);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Personalize your own view of the portal.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team &amp; access</CardTitle>
          <CardDescription>
            See every leader, what they can see and do, and change it — position sets the defaults.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/access">Manage team access</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency</CardTitle>
          <CardDescription>
            All giving and ledger figures are stored in USD and converted live for display — switching this never
            changes the underlying numbers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CurrencySelectForm initialCurrency={profile.zoneCurrency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sidebar sections</CardTitle>
          <CardDescription>
            Choose which sections show in your sidebar. This only affects your own account — Assistants always see
            their fixed set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NavVisibilityForm initialHidden={profile.hiddenNavItems} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>Who did what — sensitive changes only (members, ledger, training, settings).</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center border rounded-lg border-dashed">
              No activity recorded yet.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {auditLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2.5 text-sm">
                  <History className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="leading-snug">
                      <span className="font-medium">{entry.actorName}</span>{" "}
                      <span className="text-muted-foreground">
                        {(ACTION_LABELS[entry.action] ?? entry.action).toLowerCase()}
                      </span>{" "}
                      — {entry.summary}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-300 bg-amber-50/50">
        <CardHeader>
          <CardTitle>Testing</CardTitle>
          <CardDescription>
            Signs you out and drops you on the setup wizard so a new zone can be created from scratch. Temporary —
            for trying out the wizard while we&apos;re still setting up real zones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={restartWizardAction}>
            <Button type="submit" variant="outline">
              Re-run setup wizard
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

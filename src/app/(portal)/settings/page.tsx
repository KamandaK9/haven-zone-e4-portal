import { redirect } from "next/navigation";
import Link from "next/link";
import { History } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NavVisibilityForm } from "@/components/settings/nav-visibility-form";
import { FeaturesForm } from "@/components/settings/features-form";
import { CurrencySelectForm } from "@/components/settings/currency-select-form";
import { HandbookRulesForm } from "@/components/settings/handbook-rules-form";
import { restartWizardAction } from "@/lib/actions/auth";
import { can, getCurrentProfile, getAuditLog } from "@/lib/data/get-dataset";
import { getHandbookRules } from "@/lib/handbook/rules-server";
import { tenant } from "@/tenant";
import { legalGaps } from "@/lib/privacy";
import { labels, lower } from "@/lib/labels";
import { getLegal } from "@/lib/legal-server";
import { getModules } from "@/lib/modules-server";

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
  "settings.update_handbook_rules": "Handbook thresholds",
  "cell.create": "Added a cell",
  "cell.update": "Edited a cell",
  "cell.delete": "Removed a cell",
  "cell.members": "Changed cell members",
  "record.create": "Filed a record",
  "record.update": "Edited a record",
  "record.delete": "Deleted a record",
  "record.file_remove": "Removed a file",
  "cheque.create": "Recorded a cheque",
  "cheque.update": "Updated a cheque",
  "cheque.delete": "Deleted a cheque",
  "privacy.request_update": "Answered a privacy request",
  "settings.update_legal": "Privacy details",
  "livestream.create": "Scheduled a stream",
  "livestream.update": "Edited a stream",
  "livestream.end": "Ended a stream",
  "livestream.delete": "Deleted a stream",
  "livestream.mute": "Muted someone in chat",
  "livestream.unmute": "Unmuted someone in chat",
  "church.rename": `Renamed a ${lower(labels.location)}`,
  "church.create": `Added a ${lower(labels.location)}`,
  "member.merge": "Merged duplicate members",
  "member.photo": "Changed a profile photo",
  "training_lesson.create": "Added a lesson",
  "training_lesson.update": "Edited a lesson",
  "training_lesson.delete": "Deleted a lesson",
  "newsletter.send": "Sent a newsletter",
  "member_field.create": "Added a member field",
  "member_field.update": "Changed a member field",
  "settings.theme": "Colours changed",
  "import_template.update": "Member import columns",
  "member.update_fields": "Edited a member's extra details",
};

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  const modules = await getModules();
  if (!profile) redirect("/");
  if (!can(profile, "manage_access")) redirect("/dashboard");

  const [auditLog, handbookRules] = await Promise.all([getAuditLog(profile.zoneId, 30), getHandbookRules(profile.zoneId)]);

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
          <CardTitle>Privacy &amp; legal</CardTitle>
          <CardDescription>
            Requests from people to see, correct or delete their information (30-day deadline), and the privacy notice
            and terms everyone accepts.
            {legalGaps(await getLegal(profile.zoneId)).length > 0 && (
              <span className="mt-1 block text-amber-700 dark:text-amber-400">
                The privacy notice still has placeholders to fill in before launch.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/privacy">Privacy details &amp; requests</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/privacy">Privacy notice</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/terms">Terms of use</Link>
          </Button>
        </CardContent>
      </Card>

      {can(profile, "manage_settings") && (
        <Card>
          <CardHeader>
            <CardTitle>Member fields &amp; imports</CardTitle>
            <CardDescription>
              Your own details about people (with who may see each one), and how your spreadsheet&apos;s columns are
              matched when importing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/fields">Manage member fields</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {modules.messaging && can(profile, "manage_settings") && (
        <Card>
          <CardHeader>
            <CardTitle>Messaging</CardTitle>
            <CardDescription>The monthly text cap, what a text costs, and the automatic birthday, welcome and &ldquo;we missed you&rdquo; messages.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/messaging">Messaging settings</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {can(profile, "manage_settings") && (
        <Card>
          <CardHeader>
            <CardTitle>Colours</CardTitle>
            <CardDescription>The look of the portal — pick a ready-made scheme or your own colours, with a preview and advice on what reads well.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/theme">Choose colours</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {can(profile, "manage_settings") && (
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>Where people serve — choir, ushering, media… Shown on profiles and filterable on members.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/departments">Manage departments</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>
            Everything Stratum offers. Turn the features in your plan on or off for everyone — a feature that&apos;s off
            disappears from every sidebar and its pages, and its information is kept for when you turn it back on.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeaturesForm included={tenant.modules} modules={modules} canEdit={can(profile, "manage_settings")} />
        </CardContent>
      </Card>

      {modules.attendance && (
        <Card>
          <CardHeader>
            <CardTitle>Self check-in screen</CardTitle>
            <CardDescription>The welcome on the tablet at the door — title, tagline and a background picture.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/check-in">Customise the screen</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Support requests</CardTitle>
          <CardDescription>What members and leaders have asked through the Help button.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/support">Open support inbox</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your security</CardTitle>
          <CardDescription>Add an authenticator app to your own account for a second step at sign-in.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <Link href="/security">Manage two-factor authentication</Link>
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

      {tenant.handbook && handbookRules && (
        <Card>
          <CardHeader>
            <CardTitle>Handbook thresholds</CardTitle>
            <CardDescription>
              The giving and membership each category needs, in USD. They start at the {tenant.handbook.sourceShort}&apos;s values;
              change them here when the leadership revises them. Every chapter, zone and member is re-ranked straight away.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HandbookRulesForm
              defaults={tenant.handbook.rules}
              current={handbookRules.rules}
              customised={handbookRules.customised}
              sourceName={tenant.handbook.sourceShort}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sidebar sections</CardTitle>
          <CardDescription>
            Choose which sections show in your sidebar. This only affects your own account — Assistants always see
            their fixed set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NavVisibilityForm initialHidden={profile.hiddenNavItems} modules={modules} />
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

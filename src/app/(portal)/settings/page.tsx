import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, History } from "lucide-react";
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
import { cn } from "@/lib/utils";

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

// A row that leads to a settings page of its own.
function LinkRow({ href, title, description, note, secondary }: { href: string; title: string; description: string; note?: string; secondary?: { href: string; label: string }[] }) {
  return (
    <Card className="transition-colors hover:bg-muted/30">
      <CardContent className="flex items-center gap-4 py-4">
        <div className="min-w-0 flex-1">
          <Link href={href} className="text-sm font-semibold hover:underline after:absolute after:inset-0 relative">
            {title}
          </Link>
          <p className="text-sm text-muted-foreground">{description}</p>
          {note && <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">{note}</p>}
          {secondary && (
            <div className="relative z-10 mt-1 flex flex-wrap gap-x-4 text-sm">
              {secondary.map((l) => (
                <Link key={l.href} href={l.href} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  {l.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

const TAB_INTRO: Record<string, string> = {
  general: "Features, currency and your own sidebar.",
  people: "Who can do what, and the details kept about people.",
  messaging: "Texts and email: the monthly cap and the automatic messages.",
  appearance: "How the portal and the check-in screen look.",
  privacy: "Privacy requests, legal notices and your own sign-in security.",
  activity: "What has happened, and help requests.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const profile = await getCurrentProfile();
  const modules = await getModules();
  if (!profile) redirect("/");
  if (!can(profile, "manage_access")) redirect("/dashboard");
  const admin = can(profile, "manage_settings");

  const tabs = [
    { key: "general", label: "General" },
    { key: "people", label: "People & access" },
    ...(modules.messaging && admin ? [{ key: "messaging", label: "Messaging" }] : []),
    ...(admin ? [{ key: "appearance", label: "Appearance" }] : []),
    { key: "privacy", label: "Privacy & security" },
    { key: "activity", label: "Activity & help" },
  ];
  const { tab: requested } = await searchParams;
  const tab = tabs.find((t) => t.key === requested)?.key ?? "general";

  const [auditLog, handbookRules] = await Promise.all([
    tab === "activity" ? getAuditLog(profile.zoneId, 30) : Promise.resolve([]),
    tab === "general" ? getHandbookRules(profile.zoneId) : Promise.resolve(null),
  ]);
  const legalNote =
    tab === "privacy" && legalGaps(await getLegal(profile.zoneId)).length > 0
      ? "The privacy notice still has placeholders to fill in before launch."
      : undefined;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">{TAB_INTRO[tab]}</p>
      </div>

      <nav aria-label="Settings sections" className="-mx-1 overflow-x-auto border-b">
        <ul className="flex min-w-max gap-1 px-1">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={`/settings?tab=${t.key}`}
                aria-current={t.key === tab ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  t.key === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "general" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
              <CardDescription>
                Everything Stratum offers. Turn the features in your plan on or off for everyone — a feature that&apos;s off
                disappears from every sidebar and its pages, and its information is kept for when you turn it back on.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeaturesForm included={tenant.modules} modules={modules} canEdit={admin} />
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
              <NavVisibilityForm initialHidden={profile.hiddenNavItems} modules={modules} />
            </CardContent>
          </Card>

          {(modules.giving || modules.ledger) && (
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
          )}

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
        </>
      )}

      {tab === "people" && (
        <div className="space-y-3">
          <LinkRow href="/settings/access" title="Team & access" description="See every leader, what they can see and do, and change it — position sets the defaults." />
          {admin && <LinkRow href="/settings/departments" title="Departments" description="Where people serve — choir, ushering, media… Shown on profiles and filterable on members." />}
          {admin && <LinkRow href="/settings/fields" title="Member fields & imports" description="Your own details about people (with who may see each one), and how your spreadsheet's columns are matched when importing." />}
        </div>
      )}

      {tab === "messaging" && (
        <div className="space-y-3">
          <LinkRow href="/settings/messaging" title="Messaging settings" description="The monthly text cap, what a text costs, and the automatic birthday, welcome and “we missed you” messages." />
        </div>
      )}

      {tab === "appearance" && (
        <div className="space-y-3">
          <LinkRow href="/settings/theme" title="Colours" description="Pick a ready-made scheme or your own colours, with a preview and advice on what reads well." />
          {modules.attendance && <LinkRow href="/settings/check-in" title="Self check-in screen" description="The welcome on the tablet at the door — title, tagline and a background picture." />}
        </div>
      )}

      {tab === "privacy" && (
        <div className="space-y-3">
          <LinkRow
            href="/settings/privacy"
            title="Privacy details & requests"
            description="Requests from people to see, correct or delete their information (30-day deadline), and the privacy notice and terms everyone accepts."
            note={legalNote}
            secondary={[
              { href: "/privacy", label: "Privacy notice" },
              { href: "/terms", label: "Terms of use" },
            ]}
          />
          <LinkRow href="/security" title="Your security" description="Add an authenticator app to your own account for a second step at sign-in." />
        </div>
      )}

      {tab === "activity" && (
        <>
          <LinkRow href="/settings/support" title="Support requests" description="What members and leaders have asked through the Help button." />

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
                <div className="space-y-2.5 max-h-96 overflow-y-auto">
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
        </>
      )}
    </div>
  );
}

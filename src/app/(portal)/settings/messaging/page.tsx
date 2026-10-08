import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessagingSettingsForm } from "@/components/settings/messaging-form";
import { UsageMeter } from "@/components/messages/usage-meter";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getMessagingSettings, getSmsUsage } from "@/lib/messaging/settings";
import { smsIsConfigured } from "@/lib/messaging/twilio";
import { emailIsConfigured } from "@/lib/email";
import { getSiteUrl } from "@/lib/site-url";
import { requireModule } from "@/lib/require-module";

export const metadata = { title: "Messaging settings" };

export default async function MessagingSettingsPage() {
  await requireModule("messaging");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "manage_settings")) redirect("/settings");
  const settings = await getMessagingSettings(profile.zoneId);
  const usage = await getSmsUsage(profile.zoneId, settings);
  const sms = smsIsConfigured();
  const email = emailIsConfigured();
  const inbound = `${await getSiteUrl()}/api/messaging/twilio-inbound`;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Messaging" }]} />
      <Card>
        <CardHeader>
          <CardTitle>Connections</CardTitle>
          <CardDescription>Whether texts and email can go out from this portal right now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            <span className={sms ? "text-emerald-700" : "text-amber-700"}>●</span> Texts (Twilio): {sms ? "connected" : "not connected — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM"}
          </p>
          <p>
            <span className={email ? "text-emerald-700" : "text-amber-700"}>●</span> Email: {email ? "connected" : "not connected — add SENDGRID_API_KEY and EMAIL_FROM"}
          </p>
          {sms && (
            <p className="text-xs text-muted-foreground">
              So people can reply STOP, set your Twilio number&apos;s &ldquo;A message comes in&rdquo; webhook to <code className="rounded bg-muted px-1">{inbound}</code> (HTTP POST).
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>This month</CardTitle>
        </CardHeader>
        <CardContent>
          <UsageMeter usage={usage} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Messaging settings</CardTitle>
          <CardDescription>The cap, the cost estimate, and the automatic messages.</CardDescription>
        </CardHeader>
        <CardContent>
          <MessagingSettingsForm
            digestAvailable
            initial={{
              monthlySmsCap: settings.monthlySmsCap,
              smsCostEstimate: settings.smsCostEstimate,
              smsFooter: settings.smsFooter,
              birthdayEnabled: settings.birthdayEnabled,
              welcomeEnabled: settings.welcomeEnabled,
              missedEnabled: settings.missedEnabled,
              digestEnabled: settings.digestEnabled,
              birthdayTemplate: settings.birthdayTemplate,
              birthdayGuardianTemplate: settings.birthdayGuardianTemplate,
              welcomeTemplate: settings.welcomeTemplate,
              missedTemplate: settings.missedTemplate,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

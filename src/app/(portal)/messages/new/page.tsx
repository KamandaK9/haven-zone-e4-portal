import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ComposeForm } from "@/components/messages/compose-form";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getZoneCells } from "@/lib/data/cells";
import { getDepartments } from "@/lib/data/departments";
import { createClient } from "@/lib/supabase/server";
import { smsIsConfigured } from "@/lib/messaging/twilio";
import { emailIsConfigured } from "@/lib/email";
import { requireModule } from "@/lib/require-module";
import { labels } from "@/lib/labels";
import { tenant } from "@/tenant";

export const metadata = { title: "New message" };

export default async function NewMessagePage() {
  await requireModule("messaging");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "send_messages")) redirect("/messages");

  const supabase = await createClient();
  const [{ data: churches }, cells, departments] = await Promise.all([
    supabase.from("churches").select("id, name, is_office").order("name"),
    getZoneCells(profile.zoneId),
    getDepartments(),
  ]);
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Messages", href: "/messages" }, { label: "New message" }]} />
      <ComposeForm
        churches={(churches ?? []).filter((c) => !c.is_office).map((c) => ({ id: c.id, name: c.name }))}
        cells={cells.sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name }))}
        departments={departments}
        ageGroups={(tenant.ageGroups ?? []).map((g) => ({ key: g.key, label: g.label }))}
        canApprove={can(profile, "approve_messages")}
        smsReady={smsIsConfigured()}
        emailReady={emailIsConfigured()}
        labels={{ location: labels.location, cell: labels.cell }}
      />
    </div>
  );
}

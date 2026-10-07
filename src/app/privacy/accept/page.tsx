import { redirect } from "next/navigation";
import { AcceptPrivacyForm } from "@/components/legal/accept-privacy-form";
import { LegalFrame } from "@/components/legal/legal-frame";
import { PrivacyNotice } from "@/components/legal/privacy-notice";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { tenant } from "@/tenant";

// Where the signed-in layouts send a login that hasn't accepted the current
// privacy notice. Standalone (outside those layouts) so it isn't redirected
// back to itself.
export default async function AcceptPrivacyPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  return (
    <LegalFrame title={`Your privacy at ${tenant.name}`}>
      <p className="text-sm text-muted-foreground">
        Before you continue, please read how we look after your personal information. You only need to do this once, and
        again if the notice changes.
      </p>
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border p-5">
        <PrivacyNotice />
      </div>
      <AcceptPrivacyForm isLeader={profile.role !== "member"} />
    </LegalFrame>
  );
}

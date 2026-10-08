import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { PortalFrame } from "@/components/layout/portal-shell";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { getModules } from "@/lib/modules-server";
import { requireAal2IfEnrolled, requireOwnPassword } from "@/lib/mfa";
import { requirePrivacyAccepted } from "@/lib/privacy-server";
import { IdleSignOut } from "@/components/layout/idle-sign-out";
import { LEADER_IDLE_MINUTES } from "@/lib/idle";
import { positionLabel } from "@/lib/access";
import { getNotifications } from "@/lib/data/notifications";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.setupComplete) redirect("/setup");
  if (profile.role === "member") redirect("/me");
  await requireOwnPassword();
  await requirePrivacyAccepted(profile.userId, profile.zoneId);
  await requireAal2IfEnrolled();
  const modules = await getModules();
  const idleMinutes = LEADER_IDLE_MINUTES;
  const notifications = await getNotifications(profile, modules);

  return (
    <PortalFrame
      sidebar={<SidebarNav zoneName={profile.zoneName} role={profile.role} caps={profile.caps} hiddenNavItems={profile.hiddenNavItems} modules={modules} />}
      topbar={
        <Topbar
          zoneName={profile.zoneName}
          fullName={profile.fullName}
          positionLabel={positionLabel(profile.position)}
          role={profile.role}
          caps={profile.caps}
          hiddenNavItems={profile.hiddenNavItems}
          modules={modules}
          notifications={notifications}
        />
      }
    >
      <IdleSignOut minutes={idleMinutes} />
      {children}
    </PortalFrame>
  );
}

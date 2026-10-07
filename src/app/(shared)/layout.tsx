import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { PortalFrame } from "@/components/layout/portal-shell";
import { MemberSidebar } from "@/components/member-portal/member-sidebar";
import { MemberTopbar } from "@/components/member-portal/member-topbar";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { getModules } from "@/lib/modules-server";
import { requireAal2IfEnrolled, requireOwnPassword } from "@/lib/mfa";
import { requirePrivacyAccepted } from "@/lib/privacy-server";
import { IdleSignOut } from "@/components/layout/idle-sign-out";
import { LEADER_IDLE_MINUTES, MEMBER_IDLE_MINUTES } from "@/lib/idle";
import { positionLabel } from "@/lib/access";

// Pages everyone signed in can open — leaders and members alike. Same portal
// frame for both; only which nav items show up differs, via PortalFrame.
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.setupComplete) redirect("/setup");
  await requireOwnPassword();
  await requirePrivacyAccepted(profile.userId, profile.zoneId);
  await requireAal2IfEnrolled();
  const modules = await getModules();
  const idleMinutes = profile.role === "member" ? MEMBER_IDLE_MINUTES : LEADER_IDLE_MINUTES;

  if (profile.role === "member") {
    return (
      <PortalFrame
        sidebar={<MemberSidebar zoneName={profile.zoneName} />}
        topbar={<MemberTopbar zoneName={profile.zoneName} fullName={profile.fullName} />}
      >
        <IdleSignOut minutes={idleMinutes} />
        {children}
      </PortalFrame>
    );
  }

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
        />
      }
    >
      <IdleSignOut minutes={idleMinutes} />
      {children}
    </PortalFrame>
  );
}

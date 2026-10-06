import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { PortalFrame } from "@/components/layout/portal-shell";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { requireAal2IfEnrolled, requireOwnPassword } from "@/lib/mfa";
import { IdleSignOut } from "@/components/layout/idle-sign-out";
import { LEADER_IDLE_MINUTES } from "@/lib/idle";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.setupComplete) redirect("/setup");
  if (profile.role === "member") redirect("/me");
  await requireOwnPassword();
  await requireAal2IfEnrolled();
  const idleMinutes = LEADER_IDLE_MINUTES;

  return (
    <PortalFrame
      sidebar={<SidebarNav zoneName={profile.zoneName} role={profile.role} caps={profile.caps} hiddenNavItems={profile.hiddenNavItems} />}
      topbar={
        <Topbar
          zoneName={profile.zoneName}
          fullName={profile.fullName}
          role={profile.role}
          caps={profile.caps}
          hiddenNavItems={profile.hiddenNavItems}
        />
      }
    >
      <IdleSignOut minutes={idleMinutes} />
      {children}
    </PortalFrame>
  );
}

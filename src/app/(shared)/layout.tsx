import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { PortalFrame } from "@/components/layout/portal-shell";
import { MemberSidebar } from "@/components/member-portal/member-sidebar";
import { MemberTopbar } from "@/components/member-portal/member-topbar";
import { getCurrentProfile } from "@/lib/data/get-dataset";

// Pages everyone signed in can open — leaders and members alike. Same portal
// frame for both; only which nav items show up differs, via PortalFrame.
export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.setupComplete) redirect("/setup");

  if (profile.role === "member") {
    return (
      <PortalFrame
        sidebar={<MemberSidebar zoneName={profile.zoneName} />}
        topbar={<MemberTopbar zoneName={profile.zoneName} fullName={profile.fullName} />}
      >
        {children}
      </PortalFrame>
    );
  }

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
      {children}
    </PortalFrame>
  );
}

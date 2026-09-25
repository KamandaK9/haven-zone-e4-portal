import { redirect } from "next/navigation";
import { PortalFrame } from "@/components/layout/portal-shell";
import { MemberSidebar } from "@/components/member-portal/member-sidebar";
import { MemberTopbar } from "@/components/member-portal/member-topbar";
import { getCurrentProfile } from "@/lib/data/get-dataset";

// Same frame the staff portal uses (fixed sidebar, top bar, content area) —
// see (shared)/layout.tsx, which renders the identical member chrome for
// /events and /event/[id]. Kept as its own layout because /me and
// /me/calendar are member-only routes staff never redirect into.
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/?from=member");
  if (!profile.setupComplete) redirect("/setup");
  if (profile.role !== "member") redirect("/dashboard");

  return (
    <PortalFrame
      sidebar={<MemberSidebar zoneName={profile.zoneName} />}
      topbar={<MemberTopbar zoneName={profile.zoneName} fullName={profile.fullName} />}
    >
      {children}
    </PortalFrame>
  );
}

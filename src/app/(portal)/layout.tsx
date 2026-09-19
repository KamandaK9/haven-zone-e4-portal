import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentProfile } from "@/lib/data/get-dataset";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.setupComplete) redirect("/setup");
  if (profile.role === "member") redirect("/me");

  return (
    <div className="min-h-screen bg-background">
      <SidebarNav zoneName={profile.zoneName} role={profile.role} hiddenNavItems={profile.hiddenNavItems} />
      <div className="md:pl-64 flex flex-col min-h-screen">
        <Topbar
          zoneName={profile.zoneName}
          fullName={profile.fullName}
          role={profile.role}
          hiddenNavItems={profile.hiddenNavItems}
        />
        <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

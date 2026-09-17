import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Topbar } from "@/components/layout/topbar";
import { SetupGate } from "@/components/layout/setup-gate";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SetupGate>
      <div className="min-h-screen bg-background">
        <SidebarNav />
        <div className="md:pl-64 flex flex-col min-h-screen">
          <Topbar />
          <main className="flex-1 p-4 md:p-8 max-w-[1400px] w-full mx-auto">{children}</main>
        </div>
      </div>
    </SetupGate>
  );
}

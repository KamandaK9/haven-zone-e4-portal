import { redirect } from "next/navigation";
import { MemberTopbar } from "@/components/member-portal/member-topbar";
import { getCurrentProfile } from "@/lib/data/get-dataset";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.setupComplete) redirect("/setup");
  if (profile.role !== "member") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background">
      <MemberTopbar zoneName={profile.zoneName} />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}

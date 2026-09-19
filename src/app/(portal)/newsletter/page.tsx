import { redirect } from "next/navigation";
import { NewsletterComposer } from "@/components/newsletter/newsletter-composer";
import { getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";

export default async function NewsletterPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (profile.role !== "super_admin") redirect("/dashboard");
  const ds = await getZoneDataset(profile.zoneId);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Newsletter</h1>
        <p className="text-sm text-muted-foreground">
          Compose an update for zone leadership, a country, or a single church.
        </p>
      </div>
      <NewsletterComposer ds={ds} zoneName={ds.zoneName} />
    </div>
  );
}

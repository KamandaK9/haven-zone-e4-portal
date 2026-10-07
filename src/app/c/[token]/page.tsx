import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCheckInScreenForZone } from "@/lib/data/check-in-screen";
import { resolveCheckInScreen } from "@/lib/check-in/screen";
import { QrCheckIn } from "@/components/check-in/qr-check-in";
import { tenant } from "@/tenant";
import { getModules } from "@/lib/modules-server";

export const metadata: Metadata = { title: `Check in · ${tenant.name}`, robots: { index: false } };

const KIND = { sunday: "Sunday service", midweek: "Midweek service", special: "Special service" } as Record<string, string>;

// The page a QR code opens: check yourself in on your own phone. Public — the
// code is the key, and it stops working the day after the service.
export default async function QrCheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data } = await createAdminClient().rpc("qr_link_info", { p_token: token.slice(0, 64) });
  // A link only works while attendance is switched on.
  const link = (await getModules()).attendance ? data?.[0] : undefined;
  const look = link ? await getCheckInScreenForZone(link.zone_id) : resolveCheckInScreen(null);
  const service = link
    ? {
        title: link.name || KIND[link.kind] || "Service",
        date: new Date(`${link.service_date}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" }),
        location: link.church_name,
      }
    : undefined;
  return <QrCheckIn token={token} look={look} service={service} />;
}

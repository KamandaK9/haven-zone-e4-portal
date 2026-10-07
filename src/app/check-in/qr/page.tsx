import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { BrandMark } from "@/components/brand-mark";
import { PrintButton } from "@/components/check-in/print-button";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getCheckInLink } from "@/lib/actions/check-in";
import { getCheckInScreen } from "@/lib/data/check-in-screen";
import { requireModule } from "@/lib/require-module";
import type { ServiceKind } from "@/lib/check-in/types";
import { tenant } from "@/tenant";

export const metadata = { title: "QR check-in poster" };

const KIND: Record<ServiceKind, string> = { sunday: "Sunday service", midweek: "Midweek service", special: "Special service" };

// A printable poster (or something to put on the screen) with the service's
// QR code: people scan it and check themselves in on their own phone.
export default async function QrPosterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  requireModule("attendance");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!can(profile, "check_in")) redirect("/dashboard");

  const q = await searchParams;
  const kind = (["sunday", "midweek", "special"].includes(q.kind ?? "") ? q.kind : "sunday") as ServiceKind;
  if (!q.church || !q.date) redirect("/check-in/kiosk");
  const link = await getCheckInLink({ churchId: q.church, date: q.date, kind, name: q.name ?? "" });
  if (!link.ok) return <p className="p-6 text-sm text-red-700">{link.error}</p>;

  const svg = await QRCode.toString(link.url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  const look = await getCheckInScreen(profile.zoneId);
  const when = new Date(`${q.date}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-dvh bg-white text-neutral-900">
      <div className="mx-auto flex max-w-xl flex-col items-center px-8 py-12 text-center print:py-6">
        <BrandMark size={96} />
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">{look.title}</h1>
        {look.tagline && (
          <div className="mt-3 flex items-center gap-3" style={{ color: look.accent }}>
            <span className="h-px w-12" style={{ backgroundColor: look.accent }} />
            <span className="text-sm font-semibold uppercase tracking-[0.3em]">{look.tagline}</span>
            <span className="h-px w-12" style={{ backgroundColor: look.accent }} />
          </div>
        )}
        <p className="mt-10 text-3xl font-semibold">Scan to check in</p>
        <p className="mt-2 text-neutral-600">Open your phone&apos;s camera, point it here, and enter your phone number.</p>
        <div
          className="mt-8 w-80 rounded-3xl border-4 p-4 [&_svg]:h-auto [&_svg]:w-full"
          style={{ borderColor: look.accent }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="mt-6 text-lg font-medium">
          {q.name || KIND[kind]} · {when}
        </p>
        <p className="mt-1 text-xs text-neutral-500">This code works for this service only.</p>
        <p className="mt-8 text-xs text-neutral-400">{tenant.portalName}</p>
        <div className="mt-8 print:hidden">
          <PrintButton />
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { labels } from "@/lib/labels";
import { tenant } from "@/tenant";

export const metadata = { title: `Privacy notice · ${tenant.portalName}` };

const l = (s: string) => s.toLowerCase();
const TBC = <span className="rounded bg-amber-100 px-1 text-amber-900">to be confirmed</span>;

// POPIA notice for the people whose information the portal holds. The
// wording is a starting point the organisation must review; it shows as a
// draft until tenant.privacy.reviewed.
export default function PrivacyPage() {
  const p = tenant.privacy ?? {};
  const m = tenant.modules;
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10 text-sm leading-relaxed">
      <div className="flex items-center gap-3">
        <BrandMark size={36} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Privacy notice</h1>
          <p className="text-muted-foreground">{tenant.portalName}</p>
        </div>
      </div>

      {!p.reviewed && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
          Draft — {tenant.name} still needs to review this notice and confirm its contact details.
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Who we are</h2>
        <p>
          {tenant.name}
          {tenant.affiliation ? ` (${tenant.affiliation.replace(/^An? /, "").toLowerCase()})` : ""} is responsible for the
          personal information in this portal, under South Africa&apos;s Protection of Personal Information Act (POPIA).
        </p>
        <p>
          Information Officer: {p.informationOfficer ?? TBC}. Contact: {p.contactEmail ?? TBC}
          {p.contactPhone ? `, ${p.contactPhone}` : ""}.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">What we hold, and why</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your name, title, contact details and birthday — to keep in touch with you and care for you.</li>
          <li>
            Your {l(labels.location)}, {l(labels.cell)} and age group — so the right leaders can look after you.
          </li>
          {m.attendance && <li>Which services you attended — so leaders notice when you&apos;ve been away and can follow up.</li>}
          {m.courses && tenant.course && <li>Your {tenant.course.name} classes — to record your progress.</li>}
          {m.attendance && <li>Notes of follow-up contact — so care isn&apos;t duplicated or missed.</li>}
          {m.giving && <li>Your giving — for the church&apos;s records.</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Who can see it</h2>
        <p>
          Only church leaders with a login, and each sees only their part: a {l(labels.cell)} leader sees their{" "}
          {l(labels.cell)}, a {l(labels.location)} pastor their {l(labels.location)}. Check-in volunteers and teachers see
          names only — never contact details. Every change and every download is recorded.
        </p>
        <p>We don&apos;t sell your information or share it outside {tenant.name}, except where the law requires it.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Where it&apos;s kept</h2>
        <p>
          On secure servers run by our hosting providers in the European Union, protected by encryption and access controls.
          Phones used for check-in keep only names, {l(labels.cells)} and age groups, cleared when the volunteer signs out.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">How long</h2>
        <p>While you&apos;re part of {tenant.name}. When you ask us to, we delete your record and everything linked to it.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Your rights</h2>
        <p>
          You can ask for a copy of what we hold about you, ask us to correct it, ask us to delete it, or object to how we use it.
          Contact the Information Officer above. You may also complain to the Information Regulator (inforegulator.org.za).
        </p>
      </section>

      <p className="pt-4">
        <Link href="/" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

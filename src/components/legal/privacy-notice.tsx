import { tenant } from "@/tenant";
import { getLegal } from "@/lib/legal-server";

// The privacy notice (POPIA s18), built from the tenant's legal details and
// the features this deployment has switched on — so it lists only data the
// portal actually collects. Wording is plain on purpose; have it reviewed
// for your organisation before launch.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export async function PrivacyNotice() {
  const { modules, name } = tenant;
  const legal = await getLegal();
  const io = legal.informationOfficer;
  const deputy = legal.deputyInformationOfficer;
  const r = legal.retention;

  return (
    <div className="space-y-6">
      <Section title="Who we are">
        <p>
          <strong>{legal.organisationName}</strong> (“{name}”, “we”) is responsible for the personal information kept in
          this portal. Our address is {legal.physicalAddress}.
        </p>
        <p>
          Our Information Officer is <strong>{io.name}</strong> ({io.email}
          {io.phone ? `, ${io.phone}` : ""})
          {deputy ? (
            <>
              , and our Deputy Information Officer is <strong>{deputy.name}</strong> ({deputy.email})
            </>
          ) : null}
          . Contact them about anything in this notice.
        </p>
      </Section>

      <Section title="What we keep about you">
        <ul>
          <li>
            <strong>Identity and contact details</strong>: your name, title, email, phone number, photo, and — where you or
            your leaders have provided them — profession, spouse&apos;s name, birthday and wedding anniversary.
          </li>
          <li>
            <strong>Your place in the organisation</strong>: your chapter, group or cell, country, any leadership position
            you hold, and when you joined.
          </li>
          {legal.religiousBody && (
            <li>
              <strong>Religious affiliation</strong>: being a member of {name} shows your religious beliefs, which the law
              treats as special personal information. As a religious organisation we may process it about our own members
              for our religious purposes; we don&apos;t share it outside the organisation except as this notice describes.
            </li>
          )}
          {modules.giving && (
            <li>
              <strong>Giving</strong>: the amounts and types of your contributions (e.g. dues and projects), by month.
            </li>
          )}
          {modules.training && <li><strong>Training</strong>: the courses you take, your progress and quiz results.</li>}
          {modules.livestreams && (
            <li>
              <strong>Livestreams</strong>: that you joined a stream, and messages you post in its chat.
            </li>
          )}
          {modules.records && (
            <li>
              <strong>Records</strong>: you may be named in meeting minutes or correspondence kept by your chapter.
            </li>
          )}
          <li>
            <strong>Your account</strong>: sign-in details, security settings, actions you take as a leader (an audit
            log), help and privacy requests you send us.
          </li>
        </ul>
        <p>
          Most of this comes from you or from your chapter&apos;s leaders and records. Giving your contact details is
          voluntary, but without them we can&apos;t give you access to the portal or keep in touch.
        </p>
      </Section>

      <Section title="Why we use it">
        <ul>
          <li>To run membership: knowing who belongs where, caring for members and organising leadership.</li>
          {modules.giving && <li>To keep accurate financial records and give you a statement of your contributions.</li>}
          {(modules.training || modules.livestreams || modules.events) && (
            <li>To provide training, events and livestreams, and to show your own progress.</li>
          )}
          <li>To communicate with you, including newsletters (you can object to these at any time).</li>
          <li>To keep the portal and your information secure, and to meet our legal obligations.</li>
        </ul>
        <p>
          We rely on your membership relationship with us and our legitimate interests as a religious organisation, on
          your consent where we ask for it, and on legal obligations (e.g. keeping financial records).
        </p>
      </Section>

      <Section title="Who sees it">
        <p>
          Inside the organisation, people see only what their role needs: leaders see members in their own area, and
          only finance leaders see individual giving. Other members never see your contact details or giving.
        </p>
        <p>We use these service providers, who process information only on our instructions and must keep it secure:</p>
        <ul>
          {legal.operators.map((o) => (
            <li key={o.name}>
              <strong>{o.name}</strong> — {o.purpose} ({o.location})
            </li>
          ))}
        </ul>
        <p>
          Some of these store or process information outside South Africa. We only use providers bound by data
          protection rules or agreements giving protection comparable to POPIA. We don&apos;t sell your information.
        </p>
      </Section>

      <Section title="How long we keep it">
        <ul>
          <li>Membership details: while you&apos;re a member, and for {r.membersAfterLeaving} years after you leave.</li>
          {modules.giving && <li>Giving and financial records: {r.financial} years, as financial records must be kept.</li>}
          <li>Leaders&apos; audit log: {r.auditLog} years.</li>
          <li>Help and privacy requests: {r.supportAndRequests} years after they&apos;re closed.</li>
        </ul>
        <p>After that we delete it, or keep it only in a form that no longer identifies you.</p>
      </Section>

      <Section title="How we protect it">
        <p>
          Access is limited by role and enforced by the database itself; documents are stored privately and opened only
          through short-lived links; connections are encrypted; leaders are signed out when inactive; and two-step
          sign-in is available to everyone. If a breach puts your information at risk, we will tell you and the
          Information Regulator as the law requires.
        </p>
      </Section>

      <Section title="Your rights">
        <p>You may:</p>
        <ul>
          <li>ask what information we hold about you and get a copy (you can download most of it yourself from “Your data”);</li>
          <li>ask us to correct or delete information that is wrong, out of date or no longer needed;</li>
          <li>object to us using your information for a particular purpose, such as newsletters;</li>
          <li>withdraw consent you have given, without affecting what was done before.</li>
        </ul>
        <p>
          Make a request from “Your data” when signed in, or contact the Information Officer. We respond within 30 days.
        </p>
        {legal.jurisdiction === "ZA" && (
          <p>
            If you&apos;re unhappy with how we handle your information, you may complain to the{" "}
            <strong>Information Regulator (South Africa)</strong> — see www.inforegulator.org.za.
          </p>
        )}
      </Section>

      <Section title="Children">
        <p>
          If a member is under 18, a parent or guardian provides and manages their information and may exercise these
          rights on their behalf.
        </p>
      </Section>

      <p className="border-t pt-4 text-xs text-muted-foreground">Version {legal.privacyNoticeVersion}</p>
    </div>
  );
}

import { tenant } from "@/tenant";
import { getLegal } from "@/lib/legal-server";

// Terms of use for the portal. Short and plain; the leader confidentiality
// clause is what matters most — leaders see other people's information.
export async function TermsOfUse() {
  const { name } = tenant;
  const legal = await getLegal();
  const items: [string, React.ReactNode][] = [
    [
      "Who can use the portal",
      <>
        The portal is for members and leaders of {name}, using an account the organisation has given them. Accounts are
        personal: don&apos;t share your password or let anyone else use your account.
      </>,
    ],
    [
      "Leaders: keeping information confidential",
      <>
        If you&apos;re a leader you can see other people&apos;s personal information, and some can see their giving. Use it
        only for your role in {name}. Don&apos;t copy it, export it, screenshot it, or share it outside the organisation,
        and don&apos;t use it for business, marketing or anything personal. Keep downloaded files and paperwork secure and
        delete them when you no longer need them. Tell the Information Officer at once if you think information has been
        lost or seen by someone who shouldn&apos;t have it.
      </>,
    ],
    [
      "Acceptable use",
      <>
        Be respectful in chat and anywhere you can post. Don&apos;t upload anything unlawful, offensive or that you
        don&apos;t have the right to share, and don&apos;t try to access information your role doesn&apos;t give you.
        Leaders may remove content, and the organisation may suspend accounts that break these terms.
      </>,
    ],
    [
      "Your information",
      <>
        How we handle personal information is explained in the privacy notice. Records you create as a leader (minutes,
        correspondence, financial records) belong to the organisation.
      </>,
    ],
    [
      "Changes",
      <>
        We may update these terms and the privacy notice; when the privacy notice changes in substance you&apos;ll be
        asked to read and accept it again.
      </>,
    ],
    [
      "Questions",
      <>
        Contact {legal.organisationName}&apos;s Information Officer, {legal.informationOfficer.name} (
        {legal.informationOfficer.email}).
      </>,
    ],
  ];
  return (
    <div className="space-y-5">
      {items.map(([title, body]) => (
        <section key={title} className="space-y-1.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
        </section>
      ))}
    </div>
  );
}

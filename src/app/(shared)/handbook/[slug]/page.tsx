import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BlockRenderer, type HandbookRenderContext } from "@/components/handbook/block-renderer";
import { getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getDisplayCurrency } from "@/lib/currency-server";
import { formatMoney } from "@/lib/currency";
import { EVENT_SERIES_DEFS } from "@/lib/event-series";
import { buildHandbookLive } from "@/lib/handbook/live";
import { getHandbookRules } from "@/lib/handbook/rules-server";
import { tenant } from "@/tenant";

// Blocks that need the zone's data; pages without any skip loading it.
const DATA_BLOCKS = new Set(["live", "orgChart", "ladder"]);

export default async function HandbookSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");

  const content = tenant.handbook;
  const pageIndex = content?.pages.findIndex((p) => p.slug === slug) ?? -1;
  if (!content || pageIndex === -1) notFound();
  const page = content.pages[pageIndex];
  const prev = content.pages[pageIndex - 1];
  const next = content.pages[pageIndex + 1];

  const rules = (await getHandbookRules(profile.zoneId))?.rules ?? content.rules;
  const needsData = page.sections.some((s) => s.blocks.some((b) => DATA_BLOCKS.has(b.type)));
  const yearParam = typeof query.year === "string" ? Number(query.year) : null;
  const [ds, { currency, rates }] = await Promise.all([
    needsData ? getZoneDataset(profile.zoneId) : null,
    getDisplayCurrency(profile.zoneCurrency),
  ]);
  const live = ds ? buildHandbookLive(profile, ds, rules, content.roles, yearParam) : null;

  const ctx: HandbookRenderContext = {
    roles: content.roles,
    rules,
    live,
    zoneName: profile.zoneName,
    usd: (amount) => formatMoney(amount, "USD", {}),
    money: (amount) => formatMoney(amount, currency, rates),
    yearHref: (year, sectionId) => `/handbook/${page.slug}?year=${year}#${sectionId}`,
    seriesSlugs: EVENT_SERIES_DEFS.map((s) => s.slug),
    isLeader: profile.role !== "member",
    initialRoleId: typeof query.role === "string" ? query.role : undefined,
  };

  const Icon = page.icon;
  return (
    <div className="mx-auto max-w-6xl">
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-10">
        <article className="min-w-0 space-y-8">
          <div className="space-y-3">
            <Breadcrumb items={[{ label: content.title, href: "/handbook" }, { label: page.title }]} />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-primary">
                <Icon className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wide">{content.title}</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">{page.summary}</p>
            </div>
            {page.sections.length > 1 && (
              <details className="rounded-lg border px-3 py-2 text-sm xl:hidden">
                <summary className="cursor-pointer font-medium">On this page</summary>
                <SectionLinks sections={page.sections} />
              </details>
            )}
          </div>

          {page.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20 space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b pb-2">
                <h2 className="text-lg font-semibold">
                  <a href={`#${section.id}`} className="hover:underline">
                    {section.title}
                  </a>
                </h2>
                {section.sourcePages && <span className="text-xs text-muted-foreground">{content.sourceShort} p. {section.sourcePages}</span>}
              </div>
              <BlockRenderer blocks={section.blocks} sectionId={section.id} ctx={ctx} />
            </section>
          ))}

          <nav className="grid gap-3 border-t pt-6 sm:grid-cols-2" aria-label="Handbook pages">
            {prev ? (
              <Link href={`/handbook/${prev.slug}`} className="rounded-xl border p-4 hover:border-primary/40">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" /> Previous
                </span>
                <span className="font-medium">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={`/handbook/${next.slug}`} className="rounded-xl border p-4 text-right hover:border-primary/40">
                <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </span>
                <span className="font-medium">{next.title}</span>
              </Link>
            )}
          </nav>
          <p className="text-xs text-muted-foreground">Source: {content.source}</p>
        </article>

        {page.sections.length > 1 && (
          <aside className="hidden xl:block">
            <div className="sticky top-20 text-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">On this page</p>
              <SectionLinks sections={page.sections} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function SectionLinks({ sections }: { sections: { id: string; title: string }[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {sections.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="text-muted-foreground hover:text-foreground">
            {s.title}
          </a>
        </li>
      ))}
    </ul>
  );
}

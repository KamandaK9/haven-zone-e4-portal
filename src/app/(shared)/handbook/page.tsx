import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, BookMarked, Compass, Target } from "lucide-react";
import { HandbookSearch } from "@/components/handbook/handbook-search";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { buildSearchIndex } from "@/lib/handbook/search";
import { pluralize } from "@/lib/utils";
import { tenant } from "@/tenant";

export default async function HandbookPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const content = tenant.handbook;
  if (!content) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <BookMarked className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">{content.title}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">How {tenant.name} works</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The structure, rules and procedures every leader and member works by — from the {content.source}.
        </p>
      </div>

      <HandbookSearch index={buildSearchIndex(content)} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {content.pages.map((page) => {
          const Icon = page.icon;
          return (
            <Link
              key={page.slug}
              href={`/handbook/${page.slug}`}
              className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div className="flex-1 space-y-1">
                <p className="font-semibold leading-snug">{page.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{page.summary}</p>
              </div>
              <p className="flex items-center gap-1 text-xs font-medium text-primary">
                {pluralize(page.sections.length, "section")}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="space-y-4 rounded-2xl bg-primary p-6 text-primary-foreground lg:col-span-3">
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-80">
              <Compass className="h-3.5 w-3.5" /> Our vision
            </p>
            <p className="text-lg font-medium leading-snug">{content.intro.vision}</p>
          </div>
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-80">
              <Target className="h-3.5 w-3.5" /> Our mission
            </p>
            {content.intro.mission.map((p) => (
              <p key={p} className="text-sm leading-relaxed opacity-95">
                {p}
              </p>
            ))}
          </div>
        </section>
        <section className="space-y-3 rounded-2xl border bg-card p-6 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Our objectives</p>
          <ol className="space-y-2">
            {content.intro.objectives.map((o, i) => (
              <li key={o} className="flex gap-3 text-sm leading-snug">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="pt-0.5">{o}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="max-w-3xl space-y-3">
        <h2 className="text-lg font-semibold">About {tenant.name}</h2>
        {content.intro.about.map((p) => (
          <p key={p} className="text-[15px] leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}
      </section>

      <p className="border-t pt-4 text-xs text-muted-foreground">Source: {content.source}</p>
    </div>
  );
}

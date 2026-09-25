import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin } from "lucide-react";
import { EventPage } from "@/components/events/event-page";
import { AddEditionButton, EventEditorButton, SeriesEditorButton } from "@/components/events/event-editor";
import { can, getCurrentProfile } from "@/lib/data/get-dataset";
import { getEventMedia, getEventSeriesBySlug, getSeriesEditions } from "@/lib/data/events";
import { formatEventDates } from "@/lib/event-format";
import { SERIES_ICON_BY_SLUG } from "@/lib/event-series";

export default async function EventSeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const edit = (await searchParams).edit === "1";
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");

  const series = await getEventSeriesBySlug(profile.zoneId, slug);
  if (!series) notFound();

  const editions = await getSeriesEditions(profile.zoneId, series.id);
  const [latest, ...earlier] = editions;
  const media = latest ? await getEventMedia(latest.id) : [];
  const canEdit = can(profile, "manage_events");
  const Icon = SERIES_ICON_BY_SLUG[series.slug] ?? CalendarDays;

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2 min-w-0 max-w-2xl">
          <div className="flex items-center gap-2 text-primary">
            <Icon className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Annual event</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{series.name}</h2>
          {series.description && (
            <p className="text-[15px] leading-relaxed text-muted-foreground whitespace-pre-line">{series.description}</p>
          )}
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <SeriesEditorButton series={series} />
            <AddEditionButton series={series} />
          </div>
        )}
      </div>

      {latest ? (
        <EventPage
          event={latest}
          media={media}
          series={series}
          featured
          actions={
            canEdit ? (
              <EventEditorButton event={latest} media={media} defaultOpen={edit} afterDeleteHref={`/events/${series.slug}`} />
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-2xl border border-dashed p-12 text-center space-y-1">
          <p className="font-medium">No editions yet</p>
          <p className="text-sm text-muted-foreground">
            {canEdit ? "Add the first edition to start this page." : "Check back once the first edition has been added."}
          </p>
        </div>
      )}

      {earlier.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Past editions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {earlier.map((e) => (
              <Link
                key={e.id}
                href={`/event/${e.id}`}
                className="group overflow-hidden rounded-xl border bg-card hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className="relative h-32 bg-primary text-primary-foreground">
                  {e.coverUrl ? (
                    <Image src={e.coverUrl} alt="" fill sizes="(min-width: 1024px) 33vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center opacity-25">
                      <Icon className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-medium leading-snug">{e.title}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3 w-3" /> {formatEventDates(e.date, e.endDate)}
                  </p>
                  {e.location && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {e.location}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

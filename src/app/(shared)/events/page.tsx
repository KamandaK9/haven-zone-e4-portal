import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { getEventSeriesList, getLatestEditionsBySeries } from "@/lib/data/events";
import { formatEventDates } from "@/lib/event-format";
import { SERIES_ICON_BY_SLUG } from "@/lib/event-series";
import { pluralize } from "@/lib/utils";

export default async function EventsIndexPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  const [seriesList, latestBySeries] = await Promise.all([
    getEventSeriesList(profile.zoneId),
    getLatestEditionsBySeries(profile.zoneId),
  ]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Annual events</h1>
        <p className="text-sm text-muted-foreground">
          The gatherings that come round every year — descriptions, pictures, resources and videos from each edition.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {seriesList.map((series) => {
          const entry = latestBySeries.get(series.id);
          const Icon = SERIES_ICON_BY_SLUG[series.slug] ?? CalendarDays;
          return (
            <Link
              key={series.id}
              href={`/events/${series.slug}`}
              className="group overflow-hidden rounded-2xl border bg-card hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="relative h-40 bg-primary text-primary-foreground">
                {entry?.latest.coverUrl ? (
                  <Image
                    src={entry.latest.coverUrl}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center opacity-25">
                    <Icon className="h-16 w-16" />
                  </div>
                )}
              </div>
              <div className="p-4 space-y-1">
                <p className="font-semibold leading-snug">{series.name}</p>
                {entry ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {entry.latest.title} · {formatEventDates(entry.latest.date, entry.latest.endDate)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">No editions added yet</p>
                )}
                {entry && entry.count > 1 && (
                  <p className="text-xs text-muted-foreground">{pluralize(entry.count, "edition")}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

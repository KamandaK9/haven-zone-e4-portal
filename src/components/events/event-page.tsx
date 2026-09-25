import Image from "next/image";
import { CalendarDays, Download, ExternalLink, FileText, MapPin, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EventGallery } from "./event-gallery";
import { formatEventDates, isPastEvent } from "@/lib/event-format";
import { videoEmbedUrl } from "@/lib/event-media";
import { SERIES_ICON_BY_SLUG } from "@/lib/event-series";
import type { CalendarEvent, EventMedia, EventSeries } from "@/lib/data/types";

// One event's page: a hero, what it was about, pictures, downloadable
// resources, and — last — videos. The same component renders a calendar event,
// a flagship edition, and the "latest edition" on a series page.
export function EventPage({
  event,
  media,
  series,
  actions,
  featured = false,
}: {
  event: CalendarEvent;
  media: EventMedia[];
  series?: EventSeries | null;
  actions?: React.ReactNode; // edit controls, only passed to people who may edit
  featured?: boolean; // the latest edition on a series page
}) {
  const images = media.filter((m) => m.kind === "image");
  const files = media.filter((m) => m.kind === "file");
  const videos = media.filter((m) => m.kind === "video");
  const past = isPastEvent(event.date, event.endDate);
  const Icon = (series && SERIES_ICON_BY_SLUG[series.slug]) || CalendarDays;

  return (
    <article className="space-y-8">
      <header className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground">
        {event.coverUrl ? (
          <>
            <div className="relative h-64 sm:h-80">
              <Image src={event.coverUrl} alt="" fill priority sizes="(min-width: 1024px) 1000px, 100vw" className="object-cover" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          </>
        ) : (
          <div className="h-56 sm:h-64 flex items-center justify-center opacity-25">
            <Icon className="h-24 w-24" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {featured && <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/20">Latest edition</Badge>}
            {series && !featured && <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/20">{series.name}</Badge>}
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/20">{past ? "Past event" : "Upcoming"}</Badge>
          </div>
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white">{event.title}</h1>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/85">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> {formatEventDates(event.date, event.endDate)}
            </span>
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {event.location}
              </span>
            )}
          </div>
        </div>
        {actions && <div className="absolute right-4 top-4">{actions}</div>}
      </header>

      {event.description ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">About this event</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground whitespace-pre-line">{event.description}</p>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed p-6 text-center">
          No description yet.
        </p>
      )}

      {images.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pictures</h2>
          <EventGallery images={images} />
        </section>
      )}

      {files.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Resources</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {files.map((f) => (
              <li key={f.id}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-primary/40 hover:shadow-sm transition-all"
                >
                  <span className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.title || "Download"}</span>
                  <Download className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {videos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Videos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {videos.map((v) => {
              const embed = videoEmbedUrl(v.url);
              return embed ? (
                <div key={v.id} className="space-y-1.5">
                  <div className="aspect-video overflow-hidden rounded-xl bg-black">
                    <iframe
                      src={embed}
                      title={v.title || "Event video"}
                      className="h-full w-full"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  {v.title && <p className="text-sm text-muted-foreground">{v.title}</p>}
                </div>
              ) : (
                <a
                  key={v.id}
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 hover:border-primary/40 transition-all"
                >
                  <PlayCircle className="h-5 w-5 text-primary shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{v.title || v.url}</span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                </a>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}

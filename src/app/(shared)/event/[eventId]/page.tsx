import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EventPage } from "@/components/events/event-page";
import { EventEditorButton } from "@/components/events/event-editor";
import { getCurrentProfile } from "@/lib/data/get-dataset";
import { canEditEventPage, getEventById, getEventMedia, getSeriesById } from "@/lib/data/events";

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { eventId } = await params;
  const edit = (await searchParams).edit === "1";
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");

  const event = await getEventById(eventId);
  if (!event) notFound();

  const [media, series, canEdit] = await Promise.all([
    getEventMedia(event.id),
    event.seriesId ? getSeriesById(event.seriesId) : Promise.resolve(null),
    canEditEventPage(event),
  ]);

  const back = series
    ? { href: `/events/${series.slug}`, label: series.name }
    : { href: profile.role === "member" ? "/me/calendar" : "/calendar", label: "Calendar" };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <Link href={back.href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> {back.label}
      </Link>
      <EventPage
        event={event}
        media={media}
        series={series}
        actions={canEdit ? <EventEditorButton event={event} media={media} defaultOpen={edit} afterDeleteHref={back.href} /> : undefined}
      />
    </div>
  );
}

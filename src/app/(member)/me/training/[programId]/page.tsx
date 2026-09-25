import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, ListChecks, Video } from "lucide-react";
import { HostedVideoPlayer } from "@/components/training/hosted-video-player";
import { LessonCompleteButton } from "@/components/training/lesson-complete-button";
import { QuizPlayer } from "@/components/training/quiz-player";
import { TrainingStatusButton } from "@/components/training/training-status-button";
import { getCurrentProfile, getZoneDataset } from "@/lib/data/get-dataset";
import { getMember } from "@/lib/data/analytics";
import { getCourseLessons, getLessonProgress, getQuizQuestionsForMember } from "@/lib/data/training-lessons";
import { videoEmbedUrl } from "@/lib/event-media";
import { cn } from "@/lib/utils";
import { isHostedVideoEnabled, signPlaybackTokens, type PlaybackTokens } from "@/lib/video/mux";
import { formatDuration } from "@/lib/video/watch";

export default async function MemberCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { programId } = await params;
  const lessonParam = (await searchParams).lesson;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");
  if (!profile.linkedMemberId) {
    return (
      <p className="text-sm text-muted-foreground">
        Your account isn&apos;t linked to a member record yet — contact your zone admin.
      </p>
    );
  }

  const ds = await getZoneDataset(profile.zoneId);
  const program = ds.trainingPrograms.find((p) => p.id === programId);
  const member = getMember(ds, profile.linkedMemberId);
  if (!program || !member) notFound();

  const lessons = await getCourseLessons(programId);
  if (lessons.length === 0) {
    // No lesson content authored yet — fall back to the original
    // single-video, single-status flow so nothing is unusable in between.
    const training = member.trainings.find((t) => t.programId === programId);
    return (
      <div className="space-y-4 max-w-2xl">
        <Link href="/me/training" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All courses
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{program.name}</h1>
          {program.description && <p className="text-sm text-muted-foreground mt-1">{program.description}</p>}
        </div>
        {program.videoUrl && (
          <a href={program.videoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <Video className="h-4 w-4" /> Watch video
          </a>
        )}
        {training && (
          <div>
            <TrainingStatusButton trainingId={training.id} status={training.status} />
          </div>
        )}
      </div>
    );
  }

  const progress = await getLessonProgress(profile.linkedMemberId, lessons.map((l) => l.id));
  const completedCount = lessons.filter((l) => progress.get(l.id)?.completed).length;

  const current =
    lessons.find((l) => l.id === lessonParam) ?? lessons.find((l) => !progress.get(l.id)?.completed) ?? lessons[0];
  const currentIndex = lessons.findIndex((l) => l.id === current.id);
  const next = lessons[currentIndex + 1];
  const currentProgress = progress.get(current.id);

  // Short-lived tokens for this viewing (the video is privately streamed).
  const hosted = current.hostedVideo;
  const playbackTokens =
    hosted?.status === "ready" && hosted.playbackId && isHostedVideoEnabled()
      ? await signPlaybackTokens(hosted.playbackId)
      : null;

  return (
    <div className="space-y-4">
      <Link href="/me/training" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> All courses
      </Link>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          {current.kind === "video" ? (
            <VideoLesson
              lesson={current}
              completed={currentProgress?.completed ?? false}
              watchedSeconds={currentProgress?.watchedSeconds ?? 0}
              playbackTokens={playbackTokens}
              viewerId={profile.linkedMemberId}
              nextHref={next ? `/me/training/${programId}?lesson=${next.id}` : undefined}
            />
          ) : (
            <QuizPlayer
              lessonId={current.id}
              title={current.title}
              passThreshold={current.passThreshold ?? current.questionCount ?? 1}
              questions={await getQuizQuestionsForMember(current.id)}
              nextHref={next ? `/me/training/${programId}?lesson=${next.id}` : undefined}
            />
          )}
        </div>

        <aside className="rounded-2xl border bg-card p-4 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Course</p>
            <h1 className="font-semibold leading-snug">{program.name}</h1>
          </div>
          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {completedCount} of {lessons.length} complete
            </p>
          </div>

          <div className="space-y-1 pt-1">
            {lessons.map((l, i) => {
              const done = progress.get(l.id)?.completed ?? false;
              const active = l.id === current.id;
              const Icon = l.kind === "quiz" ? ListChecks : Video;
              return (
                <Link
                  key={l.id}
                  href={`/me/training/${programId}?lesson=${l.id}`}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active ? "bg-primary/10" : "hover:bg-muted/60"
                  )}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] font-medium text-muted-foreground mt-0.5">
                      {i + 1}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className={cn("font-medium leading-snug", active && "text-primary")}>{l.title}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {l.kind === "quiz"
                        ? `${l.questionCount ?? 0} question${l.questionCount === 1 ? "" : "s"}`
                        : lessonDurationLabel(l)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

type Lesson = Awaited<ReturnType<typeof getCourseLessons>>[number];

// A hosted video knows its real length; otherwise fall back to whatever the
// author typed.
function lessonDurationLabel(lesson: Lesson): string {
  const seconds = lesson.hostedVideo?.durationSeconds;
  return seconds ? formatDuration(seconds) : lesson.durationLabel || "Video";
}

function VideoLesson({
  lesson,
  completed,
  watchedSeconds,
  playbackTokens,
  viewerId,
  nextHref,
}: {
  lesson: Lesson;
  completed: boolean;
  watchedSeconds: number;
  playbackTokens: PlaybackTokens | null;
  viewerId: string;
  nextHref?: string;
}) {
  const hosted = lesson.hostedVideo;
  const embed = lesson.videoUrl ? videoEmbedUrl(lesson.videoUrl) : null;
  const playable = hosted?.status === "ready" && hosted.playbackId && hosted.durationSeconds && playbackTokens;

  return (
    <div className="space-y-4">
      {playable ? (
        <HostedVideoPlayer
          lessonId={lesson.id}
          title={lesson.title}
          playbackId={hosted.playbackId!}
          tokens={playbackTokens}
          durationSeconds={hosted.durationSeconds!}
          initialWatchedSeconds={watchedSeconds}
          initiallyCompleted={completed}
          viewerId={viewerId}
        />
      ) : hosted ? (
        <div className="aspect-video flex items-center justify-center rounded-2xl bg-black text-white/60 text-sm px-6 text-center">
          {hosted.status === "errored"
            ? "This video couldn't be processed. Ask your admin to upload it again."
            : "This video is still being prepared — check back in a few minutes."}
        </div>
      ) : (
        <div className="aspect-video overflow-hidden rounded-2xl bg-black">
          {embed ? (
            <iframe
              src={embed}
              title={lesson.title}
              className="h-full w-full"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : lesson.videoUrl ? (
            <a
              href={lesson.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/80 hover:text-white transition-colors"
            >
              <Video className="h-10 w-10" />
              <span className="text-sm font-medium">Watch video ↗</span>
            </a>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/40 text-sm">No video for this lesson</div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{lesson.title}</h1>
          {lesson.description && <p className="text-sm text-muted-foreground mt-1 max-w-xl">{lesson.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Hosted videos complete by watching them (see HostedVideoPlayer). */}
          {!hosted && <LessonCompleteButton lessonId={lesson.id} completed={completed} />}
          {nextHref && (
            <a href={nextHref} className="rounded-lg border px-3 py-1.5 text-sm font-medium hover:bg-muted/60 transition-colors">
              Next lesson →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

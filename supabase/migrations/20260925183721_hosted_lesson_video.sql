-- Hosted lesson video (Stratum core). A video lesson can now carry an
-- uploaded, privately-streamed video instead of (or as well as) a pasted
-- link, and members complete it by actually watching it.

-- ─────────────────────────────────────────────────────────────────────────
-- training_lessons: the hosted video
-- ─────────────────────────────────────────────────────────────────────────

alter table training_lessons
  add column if not exists video_provider text check (video_provider in ('mux')),
  add column if not exists video_upload_id text,
  add column if not exists video_asset_id text,
  add column if not exists video_playback_id text,
  add column if not exists video_status text check (video_status in ('uploading', 'processing', 'ready', 'errored')),
  add column if not exists duration_seconds numeric;

-- The provider's webhooks identify a lesson by upload or asset id.
create unique index if not exists training_lessons_video_upload_id_idx
  on training_lessons(video_upload_id) where video_upload_id is not null;
create index if not exists training_lessons_video_asset_id_idx
  on training_lessons(video_asset_id) where video_asset_id is not null;

-- ─────────────────────────────────────────────────────────────────────────
-- training_lesson_progress: how much of a hosted video a member watched
-- ─────────────────────────────────────────────────────────────────────────

alter table training_lesson_progress
  add column if not exists watched_seconds numeric not null default 0,
  add column if not exists last_watch_report_at timestamptz;

-- Members can write their own progress rows directly (RLS allows it), so
-- the watch rules are enforced here rather than only in app code:
--   * watched_seconds / last_watch_report_at are server-only — the app
--     writes them with the service role after checking the reported time
--     against the wall clock; anything else keeps the stored values.
--   * a member can't mark a ready hosted-video lesson complete for
--     themselves until they've watched 90% of it (WATCH_COMPLETE_RATIO in
--     src/lib/video/watch.ts). Staff marking someone else complete (e.g.
--     they watched it together in person) is still allowed.
create or replace function public.guard_lesson_progress()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  -- No JWT means a direct database session (SQL editor, migrations).
  caller_role text := coalesce(auth.jwt() ->> 'role', 'service_role');
  lesson_duration numeric;
begin
  if caller_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- An upsert onto an existing row fires this INSERT trigger first, then
    -- the UPDATE trigger, which has the stored values to check against.
    if exists (select 1 from training_lesson_progress where member_id = new.member_id and lesson_id = new.lesson_id) then
      return new;
    end if;
    new.watched_seconds := 0;
    new.last_watch_report_at := null;
  else
    new.watched_seconds := old.watched_seconds;
    new.last_watch_report_at := old.last_watch_report_at;
  end if;

  if new.completed
     and (tg_op = 'INSERT' or not old.completed)
     and new.member_id = public.current_member_id() then
    select duration_seconds into lesson_duration
      from training_lessons
      where id = new.lesson_id and video_provider is not null and video_status = 'ready';
    if lesson_duration is not null and new.watched_seconds < lesson_duration * 0.9 then
      raise exception 'Watch the video to complete this lesson.' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_lesson_progress on training_lesson_progress;
create trigger guard_lesson_progress
  before insert or update on training_lesson_progress
  for each row execute function public.guard_lesson_progress();

-- Security hardening (Stratum core). Row Level Security decides which ROWS
-- someone may write, not which COLUMNS — so where a person may update their
-- own row, triggers here pin down what they may actually change. "Trusted"
-- below means the server's service role or a direct database session (no
-- JWT): those paths do their own checks in app code. Idempotent.

create or replace function public.is_trusted_writer()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'role', 'service_role') = 'service_role'
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- members: a login may edit its own row only for contact details. Leaders
-- editing members in their scope may change everything except the fields
-- that drive access (position, portfolio, the login link), which only the
-- server changes (Team & access, invites, merges, setup). Stored photo
-- paths must sit in the member's own folder.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.guard_member_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_trusted_writer() then
    return new;
  end if;

  if new.position is distinct from old.position
     or new.portfolio is distinct from old.portfolio
     or new.profile_id is distinct from old.profile_id
     or new.zone_id is distinct from old.zone_id then
    raise exception 'Positions and logins can only be changed from Team & access.' using errcode = 'insufficient_privilege';
  end if;

  -- Editing your own record without leader rights over it: contact details only.
  if old.id = public.current_member_id()
     and not (public.current_user_can('manage_members') and old.church_id in (select public.current_user_scope_church_ids()))
     and (to_jsonb(new) - array['email', 'phone']) is distinct from (to_jsonb(old) - array['email', 'phone']) then
    raise exception 'You can only change your own email and phone number.' using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_member_update on members;
create trigger guard_member_update
  before update on members
  for each row execute function public.guard_member_update();

-- ─────────────────────────────────────────────────────────────────────────
-- Stored file paths: the server deletes and signs files by the path kept in
-- a row, so a row may only ever point into its own folder. NOT VALID: new
-- and changed rows are checked; existing rows (all written by the app in
-- these formats) aren't re-scanned.
-- ─────────────────────────────────────────────────────────────────────────
alter table members drop constraint if exists members_photo_path_folder;
alter table members add constraint members_photo_path_folder
  check (photo_path is null or (photo_path like zone_id::text || '/' || id::text || '/%' and photo_path not like '%..%')) not valid;

alter table events drop constraint if exists events_cover_path_folder;
alter table events add constraint events_cover_path_folder
  check (cover_path is null or (cover_path like zone_id::text || '/' || id::text || '/%' and cover_path not like '%..%')) not valid;

alter table event_media drop constraint if exists event_media_storage_path_folder;
alter table event_media add constraint event_media_storage_path_folder
  check (storage_path is null or (storage_path like zone_id::text || '/' || event_id::text || '/%' and storage_path not like '%..%')) not valid;

alter table cheques drop constraint if exists cheques_stub_path_folder;
alter table cheques add constraint cheques_stub_path_folder
  check (stub_path is null or (stub_path like zone_id::text || '/' || church_id::text || '/%' and stub_path not like '%..%')) not valid;

-- A record file's folder is its record's chapter, which lives on another row.
create or replace function public.guard_record_file_path()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  record_zone uuid;
  record_church uuid;
begin
  select r.zone_id, r.church_id into record_zone, record_church from chapter_records r where r.id = new.record_id;
  if record_zone is null
     or new.zone_id <> record_zone
     or new.storage_path not like record_zone::text || '/' || record_church::text || '/%'
     or new.storage_path like '%..%' then
    raise exception 'That file doesn''t belong to this record''s chapter.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_record_file_path on chapter_record_files;
create trigger guard_record_file_path
  before insert or update on chapter_record_files
  for each row execute function public.guard_record_file_path();

-- ─────────────────────────────────────────────────────────────────────────
-- Training: a member can't mark a program or quiz complete by writing rows
-- directly. Programs with lessons get their status from lesson progress;
-- quiz results are only written by the server, which grades them.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.guard_training_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  lesson_count int;
  done_count int;
  derived text;
begin
  if public.is_trusted_writer() then
    return new;
  end if;
  if new.member_id is distinct from old.member_id or new.program_id is distinct from old.program_id or new.zone_id is distinct from old.zone_id then
    raise exception 'A training can''t be moved to another member or program.' using errcode = 'insufficient_privilege';
  end if;

  -- Staff with training rights may set a status by hand (e.g. done in person).
  if public.current_user_can('manage_training') then
    return new;
  end if;

  if new.status is distinct from old.status then
    select count(*) into lesson_count from training_lessons where program_id = new.program_id;
    if lesson_count > 0 then
      select count(*) into done_count
        from training_lesson_progress p
        join training_lessons l on l.id = p.lesson_id and l.program_id = new.program_id
        where p.member_id = new.member_id and p.completed;
      derived := case when done_count >= lesson_count then 'completed' when done_count > 0 then 'in_progress' else 'not_started' end;
      if new.status <> derived then
        raise exception 'Complete the lessons to finish this course.' using errcode = 'check_violation';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_training_update on trainings;
create trigger guard_training_update
  before update on trainings
  for each row execute function public.guard_training_update();

create or replace function public.guard_lesson_progress_identity()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_trusted_writer() then
    return new;
  end if;
  if tg_op = 'UPDATE' and (new.member_id is distinct from old.member_id or new.lesson_id is distinct from old.lesson_id) then
    raise exception 'Progress can''t be moved to another lesson or member.' using errcode = 'insufficient_privilege';
  end if;
  -- Quiz results come only from the server's grading.
  if new.member_id = public.current_member_id()
     and exists (select 1 from training_lessons l where l.id = new.lesson_id and l.kind = 'quiz') then
    raise exception 'Quiz results are recorded when you submit the quiz.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_lesson_progress_identity on training_lesson_progress;
create trigger guard_lesson_progress_identity
  before insert or update on training_lesson_progress
  for each row execute function public.guard_lesson_progress_identity();

-- ─────────────────────────────────────────────────────────────────────────
-- Zone and chapter settings that must not be flipped from a browser.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.guard_zone_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_trusted_writer() then
    return new;
  end if;
  if new.setup_complete is distinct from old.setup_complete
     or new.default_programs_seeded is distinct from old.default_programs_seeded then
    raise exception 'That setting can''t be changed here.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_zone_update on zones;
create trigger guard_zone_update
  before update on zones
  for each row execute function public.guard_zone_update();

-- Renaming a chapter is fine for its leaders; moving it between sub-zones or
-- countries, or marking it an office, is for the Directors.
create or replace function public.guard_church_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_trusted_writer() or public.current_user_role() = 'super_admin' then
    return new;
  end if;
  if new.sub_zone_id is distinct from old.sub_zone_id
     or new.country_id is distinct from old.country_id
     or new.is_office is distinct from old.is_office
     or new.zone_id is distinct from old.zone_id then
    raise exception 'Only the Directors can move a chapter or change its type.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_church_update on churches;
create trigger guard_church_update
  before update on churches
  for each row execute function public.guard_church_update();

-- ─────────────────────────────────────────────────────────────────────────
-- Reads that were wider than needed.
-- ─────────────────────────────────────────────────────────────────────────
-- Profiles (logins: email, position, permissions): your own, or any in the
-- zone if you're a leader. Members don't need other people's.
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select
  using (
    zone_id = public.current_user_zone_id()
    and (id = auth.uid() or public.current_user_role() in ('super_admin', 'admin'))
  );

-- Audit entries are always written as yourself.
drop policy if exists "audit_log_insert" on audit_log;
create policy "audit_log_insert" on audit_log for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_role() in ('super_admin', 'admin')
    and actor_id = auth.uid()
  );

-- Live chat: the author's name comes from their login, and a removed
-- message's text is gone for good, not just hidden.
create or replace function public.guard_live_message()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_trusted_writer() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    select full_name into new.author_name from profiles where id = auth.uid();
  else
    if new.body is distinct from old.body or new.profile_id is distinct from old.profile_id or new.stream_id is distinct from old.stream_id then
      raise exception 'Messages can''t be edited.' using errcode = 'insufficient_privilege';
    end if;
    if new.deleted_at is not null and old.deleted_at is null then
      new.body := '(removed)';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_live_message on live_stream_messages;
create trigger guard_live_message
  before insert or update on live_stream_messages
  for each row execute function public.guard_live_message();

-- ─────────────────────────────────────────────────────────────────────────
-- Rate limiting for actions that send email or can be spammed. Server-only:
-- the table has RLS on and no policies, and the function is only granted to
-- the service role.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists rate_limit_hits (
  key text not null,
  hit_at timestamptz not null default now()
);
create index if not exists rate_limit_hits_key_idx on rate_limit_hits(key, hit_at desc);
alter table rate_limit_hits enable row level security;

-- Records a hit for `p_key` and says whether it's within `p_max` per
-- `p_window_seconds`. Old hits are pruned as it goes.
create or replace function public.take_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  recent int;
begin
  delete from rate_limit_hits where key = p_key and hit_at < now() - make_interval(secs => p_window_seconds);
  select count(*) into recent from rate_limit_hits where key = p_key;
  if recent >= p_max then
    return false;
  end if;
  insert into rate_limit_hits (key) values (p_key);
  return true;
end;
$$;
revoke all on function public.take_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.take_rate_limit(text, int, int) to service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- Helper functions are for signed-in sessions; nobody anonymous needs them.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke execute on function %s from anon, public', fn.sig);
    execute format('grant execute on function %s to authenticated, service_role', fn.sig);
  end loop;
end
$$;
revoke execute on function public.take_rate_limit(text, int, int) from authenticated;

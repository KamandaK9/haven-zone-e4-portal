-- Haven Zone E4 Portal — schema + Row Level Security
-- Idempotent: safe to re-run. Paste into the Supabase SQL editor and run once.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  setup_complete boolean not null default false,
  display_currency text not null default 'USD',
  created_at timestamptz not null default now()
);
alter table zones add column if not exists display_currency text not null default 'USD';

-- One row per Supabase Auth user. id is *both* the PK and the FK to
-- auth.users, so a profile IS the login — one account, one zone, forever.
-- 'member' logins link to their own row in `members` via members.profile_id.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  role text not null check (role in ('super_admin', 'admin', 'member')),
  full_name text not null,
  email text not null,
  phone text,
  -- Super Admin's own nav personalization — which optional sections they've
  -- hidden from their own view. Assistants/members have no such setting;
  -- their nav is fixed by role.
  hidden_nav_items text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table profiles add column if not exists hidden_nav_items text[] not null default '{}';
-- Leadership position + what that login may see/do. Position, portfolio and
-- the granted/revoked overrides are the inputs; `caps` is the *effective*
-- capability list the app computes from them (see src/lib/access.ts) and RLS
-- checks. scope + sub_zone_id/church_id decide which chapters are visible.
alter table profiles add column if not exists position text not null default 'member';
alter table profiles add column if not exists portfolio text;
alter table profiles add column if not exists scope text not null default 'self'
  check (scope in ('zone', 'sub_zone', 'chapter', 'self'));
alter table profiles add column if not exists sub_zone_id uuid;
alter table profiles add column if not exists church_id uuid;
alter table profiles add column if not exists caps text[] not null default '{}';
alter table profiles add column if not exists granted_caps text[] not null default '{}';
alter table profiles add column if not exists revoked_caps text[] not null default '{}';
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('super_admin', 'admin', 'member'));

create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  name text not null,
  flag text not null default '🏳️'
);

create table if not exists churches (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  name text not null,
  city text,
  founded_year int,
  pastor text
);

-- A sub-zone groups chapters under a Sub Zone Governor (SZ1, SZ2, ...).
create table if not exists sub_zones (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  name text not null,
  unique (zone_id, name)
);
alter table churches add column if not exists sub_zone_id uuid references sub_zones(id) on delete set null;
-- The Zonal Office is a "chapter" only so zone-level leaders have a home row;
-- offices are left out of chapter counts and health.
alter table churches add column if not exists is_office boolean not null default false;

-- profile_id links this record to a real login once a member is invited to
-- the member portal. Null until then — most members never get one.
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  join_date date not null default current_date,
  role text not null default 'Member' check (role in ('Member', 'Worker', 'Cell Leader', 'Pastor')),
  avatar_color text not null default '#7c3aed',
  profile_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table members add column if not exists profile_id uuid references profiles(id) on delete set null;
create unique index if not exists members_profile_id_key on members(profile_id);

-- Leadership-roster import fields (title/kc_handle/etc. come verbatim from
-- source spreadsheets with wildly inconsistent formatting — kept as free
-- text rather than parsed into structured dates/enums to avoid corrupting
-- real data with a wrong guess).
-- Position/portfolio come from the roster's DESIGNATION column; a person's
-- login (if any) copies them onto profiles when invited.
alter table members add column if not exists position text not null default 'member';
alter table members add column if not exists portfolio text;
-- Rosters rarely carry a join date; unknown must not read as "joined today".
alter table members alter column join_date drop not null;
alter table members alter column join_date drop default;

alter table members add column if not exists title text;
alter table members add column if not exists kc_handle text;
alter table members add column if not exists profession text;
alter table members add column if not exists spouse_name text;
alter table members add column if not exists birthday text;
alter table members add column if not exists wedding_anniversary text;
alter table members add column if not exists photo_url text;
alter table members add column if not exists photo_path text;

create table if not exists giving_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  amount numeric(12, 2) not null,
  unique (member_id, month)
);

-- Giving is split into four categories the zonal financier reports on
-- (PCO, Dues, Special Project, META). Nullable: entries recorded before
-- categories existed stay uncategorised and only count toward "all giving".
alter table giving_entries add column if not exists category text
  check (category in ('pco', 'dues', 'special_project', 'meta'));

-- One entry per member per month *per category* (was per member per month).
-- The named unique constraint is what the giving import upserts against.
alter table giving_entries drop constraint if exists giving_entries_member_id_month_key;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'giving_entries_member_month_category_key') then
    alter table giving_entries
      add constraint giving_entries_member_month_category_key unique (member_id, month, category);
  end if;
end $$;

-- A zone-defined, reusable training program (optionally with a linked
-- video) that staff assign to members — replaces the old fixed 4-training
-- list with something zonal directors/governors can actually author.
create table if not exists training_programs (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  name text not null,
  description text,
  video_url text,
  -- A lucide-react icon name (see src/lib/training-icons.ts) — never an
  -- emoji; rendered as a real icon component client-side.
  icon text not null default 'BookOpen',
  points int not null default 10,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Which programs new members are enrolled in automatically. Replaces
-- re-creating the four defaults by name (which resurrected deleted programs
-- and duplicated renamed ones). Backfilled once, when the column is added:
-- the original four keep auto-assigning; after that it's the editor's choice.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'training_programs' and column_name = 'assign_to_new_members'
  ) then
    alter table training_programs add column assign_to_new_members boolean not null default false;
    update training_programs set assign_to_new_members = true
      where name in ('New Believers Class', 'Foundation School', 'Leadership Development', 'Water Baptism');
  end if;
end $$;
-- Whether the four starter programs have been created for this zone yet, so
-- deleting one never brings it back.
alter table zones add column if not exists default_programs_seeded boolean not null default false;
update zones set default_programs_seeded = true
  where default_programs_seeded = false and exists (select 1 from training_programs p where p.zone_id = zones.id);

-- A course's content: one or more lessons (a video, or a graded quiz). A
-- course with no lessons yet behaves exactly as before — a single video +
-- Start/Mark-complete on the program itself.
create table if not exists training_lessons (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references training_programs(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  kind text not null default 'video' check (kind in ('video', 'quiz')),
  title text not null,
  description text,
  video_url text,           -- kind = 'video'
  duration_label text,      -- free text, e.g. "4:12" — display only
  pass_threshold int,       -- kind = 'quiz': correct answers needed to pass
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists training_lessons_program_id_idx on training_lessons(program_id);

-- A quiz lesson's questions. correct_index is the answer key — never sent to
-- a learner's browser (see quiz_questions_for_member() below); only an
-- author (manage_training) reads this table directly.
create table if not exists training_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references training_lessons(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  question text not null,
  options text[] not null,
  correct_index int not null,
  sort_order int not null default 0
);
create index if not exists training_quiz_questions_lesson_id_idx on training_quiz_questions(lesson_id);

-- A member's progress on one lesson. The parent trainings.status
-- (not_started/in_progress/completed) is kept in sync from this — completed
-- once every lesson in the course is done — so points, the leaderboard, and
-- everything else that already reads trainings.status keeps working
-- unchanged for lesson-based courses.
create table if not exists training_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  lesson_id uuid not null references training_lessons(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  quiz_score int, -- set for a graded quiz attempt
  unique (member_id, lesson_id)
);
create index if not exists training_lesson_progress_member_id_idx on training_lesson_progress(member_id);

-- One-time backfill: give every existing program a first video lesson from
-- its own video_url/description, and carry over anyone already marked
-- completed as having completed that lesson too — "upgrading" a program to
-- a course loses no one's progress.
do $$
begin
  if not exists (select 1 from training_lessons) and exists (select 1 from training_programs) then
    insert into training_lessons (program_id, zone_id, kind, title, description, video_url, sort_order)
    select id, zone_id, 'video', name, description, video_url, 0 from training_programs;

    insert into training_lesson_progress (member_id, lesson_id, zone_id, completed, completed_at)
    select t.member_id, l.id, t.zone_id, true, coalesce(t.completed_at, now())
    from trainings t
    join training_lessons l on l.program_id = t.program_id
    where t.status = 'completed';
  end if;
end $$;

-- One row per member-per-assigned-program — the member's progress on it.
create table if not exists trainings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  name text, -- legacy free-text label, unused once program_id is set
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  unique (member_id, name)
);
alter table trainings add column if not exists program_id uuid references training_programs(id) on delete cascade;
alter table trainings add column if not exists assigned_by uuid references profiles(id) on delete set null;
alter table trainings add column if not exists assigned_at timestamptz not null default now();
alter table trainings add column if not exists completed_at timestamptz;
alter table trainings alter column name drop not null;
create unique index if not exists trainings_member_program_key on trainings(member_id, program_id) where program_id is not null;

-- Append-only record of who did what to sensitive data — no update/delete
-- policy is granted below, so once written a row can never be changed.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  actor_id uuid references profiles(id) on delete set null,
  actor_name text not null,
  action text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  type text not null check (type in ('new_member', 'training_complete', 'giving', 'baptism', 'event')),
  message text not null,
  church_id uuid references churches(id) on delete set null,
  timestamp timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  title text not null,
  date date not null,
  time text not null,
  type text not null check (type in ('meeting', 'training', 'service', 'outreach')),
  church_id uuid references churches(id) on delete set null,
  country_id uuid references countries(id) on delete set null
);

-- The five annual flagship events (National Executive Assembly, International
-- Convention, Zonal Convention, Camp Meeting, Special Programmes). Each
-- edition of one is a row in `events` pointing back here via series_id.
create table if not exists event_series (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  slug text not null,
  name text not null,
  description text,
  sort_order int not null default 0,
  unique (zone_id, slug)
);

-- Every event (an ordinary calendar entry or a flagship edition) can carry a
-- page: description, location, cover picture, and media below.
alter table events add column if not exists description text;
alter table events add column if not exists end_date date;
alter table events add column if not exists location text;
alter table events add column if not exists cover_url text;
alter table events add column if not exists cover_path text;
alter table events add column if not exists series_id uuid references event_series(id) on delete set null;
alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in ('meeting', 'training', 'service', 'outreach', 'flagship'));

-- Pictures, videos (external links) and downloadable resources on an event page.
create table if not exists event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'file')),
  url text not null,
  storage_path text, -- set for uploaded images/files; null for external video links
  title text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists event_media_event_id_idx on event_media(event_id);

-- Public bucket for event pictures and resources. Uploads never touch storage
-- RLS: the app hands out short-lived signed upload URLs after checking the
-- caller may edit the event.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-media', 'event-media', true, 26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket for member profile photos — same signed-upload-URL pattern
-- as event-media, just images and a smaller size limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-photos', 'member-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Simple income/expense ledger per church — staff-only (never visible to
-- 'member' logins).
create table if not exists ledger_entries (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  description text,
  amount numeric(12, 2) not null,
  entry_date date not null default current_date,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- A snapshot check that the ledger's running balance for a church matches
-- what's actually in the bank/cash box as of a given date — "balancing the
-- books". calculated_balance is computed server-side from ledger_entries at
-- save time (never trust a client-sent figure for this), variance = actual
-- - calculated; zero means balanced.
create table if not exists reconciliations (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  period_end date not null,
  actual_balance numeric(12, 2) not null,
  calculated_balance numeric(12, 2) not null,
  variance numeric(12, 2) not null,
  notes text,
  reconciled_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.current_user_zone_id()
returns uuid
language sql security definer stable set search_path = public
as $$
  select zone_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_role()
returns text
language sql security definer stable set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- The `members.id` a 'member'-role login is linked to, or null for
-- staff/unlinked logins.
create or replace function public.current_member_id()
returns uuid
language sql security definer stable set search_path = public
as $$
  select id from public.members where profile_id = auth.uid()
$$;

-- Whether the caller holds a capability (their stored effective caps).
create or replace function public.current_user_can(cap text)
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce(cap = any(caps), false) from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_scope_level()
returns text
language sql security definer stable set search_path = public
as $$
  select scope from public.profiles where id = auth.uid()
$$;

-- The chapters the caller may see: the whole zone, one sub-zone, or one
-- chapter, depending on their position. Members get none (they use
-- current_member_id() for their own rows).
create or replace function public.current_user_scope_church_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select c.id
  from public.churches c
  join public.profiles p on p.id = auth.uid() and p.zone_id = c.zone_id
  where p.scope = 'zone'
     or (p.scope = 'sub_zone' and c.sub_zone_id is not null and c.sub_zone_id = p.sub_zone_id)
     or (p.scope = 'chapter' and c.id = p.church_id)
$$;

-- Per-chapter/month/category giving totals for everyone in scope who may see
-- totals — this is how a Governor sees their chapter's numbers without being
-- able to read any individual's giving.
create or replace function public.giving_totals_in_scope()
returns table (church_id uuid, month text, category text, amount numeric)
language sql security definer stable set search_path = public
as $$
  select m.church_id, g.month, g.category, sum(g.amount)
  from public.giving_entries g
  join public.members m on m.id = g.member_id
  where public.current_user_can('view_giving_totals')
    and g.zone_id = public.current_user_zone_id()
    and m.church_id in (select public.current_user_scope_church_ids())
  group by m.church_id, g.month, g.category
  order by m.church_id, g.month, g.category
$$;

-- A quiz's questions, without the answer key — what a learner's page reads.
-- Grading itself happens server-side (submitQuizAttempt), which reads the
-- real table (with correct_index) via the service-role client instead.
create or replace function public.quiz_questions_for_member(p_lesson_id uuid)
returns table (id uuid, question text, options text[], sort_order int)
language sql security definer stable set search_path = public
as $$
  select q.id, q.question, q.options, q.sort_order
  from public.training_quiz_questions q
  join public.training_lessons l on l.id = q.lesson_id
  where q.lesson_id = p_lesson_id
    and l.zone_id = public.current_user_zone_id()
  order by q.sort_order
$$;

-- Bulk, answer-key-free question counts — what getCourseLessons() reads to
-- show "3 questions" on a quiz lesson. Plain SELECT counts against
-- training_quiz_questions are restricted to manage_training (the answer
-- key), which would otherwise silently return 0 for every member.
create or replace function public.quiz_question_counts(p_lesson_ids uuid[])
returns table (lesson_id uuid, count bigint)
language sql security definer stable set search_path = public
as $$
  select q.lesson_id, count(*)
  from public.training_quiz_questions q
  join public.training_lessons l on l.id = q.lesson_id
  where q.lesson_id = any(p_lesson_ids)
    and l.zone_id = public.current_user_zone_id()
  group by q.lesson_id
$$;

alter table zones enable row level security;
alter table sub_zones enable row level security;
alter table profiles enable row level security;
alter table countries enable row level security;
alter table churches enable row level security;
alter table members enable row level security;
alter table giving_entries enable row level security;
alter table trainings enable row level security;
alter table training_programs enable row level security;
alter table training_lessons enable row level security;
alter table training_quiz_questions enable row level security;
alter table training_lesson_progress enable row level security;
alter table activity enable row level security;
alter table events enable row level security;
alter table event_series enable row level security;
alter table event_media enable row level security;
alter table ledger_entries enable row level security;
alter table reconciliations enable row level security;
alter table audit_log enable row level security;

-- zones/profiles: select-only for authenticated users. All writes to these
-- two tables go through the service-role client (zone bootstrap, invites),
-- which bypasses RLS entirely by design.
drop policy if exists "zones_select" on zones;
create policy "zones_select" on zones for select
  using (id = public.current_user_zone_id());

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select
  using (zone_id = public.current_user_zone_id());

-- countries / sub_zones: everyone in the zone can read; only the Directors
-- (role super_admin) change the structure.
do $$
declare
  t text;
begin
  foreach t in array array['countries', 'sub_zones']
  loop
    execute format('drop policy if exists "%s_select" on %I', t, t);
    execute format('create policy "%s_select" on %I for select using (zone_id = public.current_user_zone_id())', t, t);
    execute format('drop policy if exists "%s_insert" on %I', t, t);
    execute format(
      'create policy "%s_insert" on %I for insert with check (zone_id = public.current_user_zone_id() and public.current_user_role() = ''super_admin'')',
      t, t
    );
    execute format('drop policy if exists "%s_update" on %I', t, t);
    execute format(
      'create policy "%s_update" on %I for update using (zone_id = public.current_user_zone_id() and public.current_user_role() = ''super_admin'') with check (zone_id = public.current_user_zone_id() and public.current_user_role() = ''super_admin'')',
      t, t
    );
    execute format('drop policy if exists "%s_delete" on %I', t, t);
    execute format(
      'create policy "%s_delete" on %I for delete using (zone_id = public.current_user_zone_id() and public.current_user_role() = ''super_admin'')',
      t, t
    );
  end loop;
end $$;

-- churches: leaders see the chapters in their scope; a member sees only their
-- own. Only the Directors change the structure.
drop policy if exists "churches_select" on churches;
create policy "churches_select" on churches for select
  using (
    zone_id = public.current_user_zone_id()
    and (
      id in (select public.current_user_scope_church_ids())
      or id = (select church_id from public.members where id = public.current_member_id())
    )
  );
drop policy if exists "churches_insert" on churches;
create policy "churches_insert" on churches for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() = 'super_admin');
-- Renaming (and other light edits) a chapter you already manage doesn't
-- need Director-level access — creating/removing chapters still does.
drop policy if exists "churches_update" on churches;
create policy "churches_update" on churches for update
  using (
    zone_id = public.current_user_zone_id()
    and (
      public.current_user_role() = 'super_admin'
      or (public.current_user_can('manage_members') and id in (select public.current_user_scope_church_ids()))
    )
  )
  with check (
    zone_id = public.current_user_zone_id()
    and (
      public.current_user_role() = 'super_admin'
      or (public.current_user_can('manage_members') and id in (select public.current_user_scope_church_ids()))
    )
  );
drop policy if exists "churches_delete" on churches;
create policy "churches_delete" on churches for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_role() = 'super_admin');

-- training_programs: everyone in the zone reads (a member needs the video and
-- description of a program assigned to them); manage_training writes.
drop policy if exists "training_programs_select" on training_programs;
create policy "training_programs_select" on training_programs for select
  using (zone_id = public.current_user_zone_id());
drop policy if exists "training_programs_insert" on training_programs;
create policy "training_programs_insert" on training_programs for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'));
drop policy if exists "training_programs_update" on training_programs;
create policy "training_programs_update" on training_programs for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'));
drop policy if exists "training_programs_delete" on training_programs;
create policy "training_programs_delete" on training_programs for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'));

-- training_lessons: everyone in the zone reads (a learner needs the video
-- link and quiz pass_threshold, just not the answer key); manage_training writes.
drop policy if exists "training_lessons_select" on training_lessons;
create policy "training_lessons_select" on training_lessons for select
  using (zone_id = public.current_user_zone_id());
drop policy if exists "training_lessons_insert" on training_lessons;
create policy "training_lessons_insert" on training_lessons for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'));
drop policy if exists "training_lessons_update" on training_lessons;
create policy "training_lessons_update" on training_lessons for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'));
drop policy if exists "training_lessons_delete" on training_lessons;
create policy "training_lessons_delete" on training_lessons for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'));

-- training_quiz_questions: the raw table (answer key included) is
-- author-only — a learner reads quiz_questions_for_member() instead, which
-- never returns correct_index.
drop policy if exists "training_quiz_questions_select" on training_quiz_questions;
create policy "training_quiz_questions_select" on training_quiz_questions for select
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'));
drop policy if exists "training_quiz_questions_insert" on training_quiz_questions;
create policy "training_quiz_questions_insert" on training_quiz_questions for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'));
drop policy if exists "training_quiz_questions_update" on training_quiz_questions;
create policy "training_quiz_questions_update" on training_quiz_questions for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'));
drop policy if exists "training_quiz_questions_delete" on training_quiz_questions;
create policy "training_quiz_questions_delete" on training_quiz_questions for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_training'));

-- training_lesson_progress: a member sees/writes their own; staff with
-- manage_training can also mark progress for a member in their scope
-- (e.g. recording that someone watched a lesson in person).
drop policy if exists "training_lesson_progress_select" on training_lesson_progress;
create policy "training_lesson_progress_select" on training_lesson_progress for select
  using (
    zone_id = public.current_user_zone_id()
    and (
      member_id = public.current_member_id()
      or (
        public.current_user_can('view_members')
        and exists (select 1 from public.members m where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids()))
      )
    )
  );
drop policy if exists "training_lesson_progress_insert" on training_lesson_progress;
create policy "training_lesson_progress_insert" on training_lesson_progress for insert
  with check (
    zone_id = public.current_user_zone_id()
    and (
      member_id = public.current_member_id()
      or (
        public.current_user_can('manage_training')
        and exists (select 1 from public.members m where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids()))
      )
    )
  );
drop policy if exists "training_lesson_progress_update" on training_lesson_progress;
create policy "training_lesson_progress_update" on training_lesson_progress for update
  using (
    zone_id = public.current_user_zone_id()
    and (
      member_id = public.current_member_id()
      or (
        public.current_user_can('manage_training')
        and exists (select 1 from public.members m where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids()))
      )
    )
  )
  with check (
    zone_id = public.current_user_zone_id()
    and (
      member_id = public.current_member_id()
      or (
        public.current_user_can('manage_training')
        and exists (select 1 from public.members m where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids()))
      )
    )
  );

-- members: a leader sees the members of the chapters in their scope; a
-- 'member' login sees and updates only their own linked row (the app limits
-- that update to contact-info fields — RLS can't scope by column). Contact
-- details are stripped server-side for leaders without view_contact_details.
drop policy if exists "members_select" on members;
create policy "members_select" on members for select
  using (
    zone_id = public.current_user_zone_id()
    and (
      id = public.current_member_id()
      or (public.current_user_can('view_members') and church_id in (select public.current_user_scope_church_ids()))
    )
  );
drop policy if exists "members_insert" on members;
create policy "members_insert" on members for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_members')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "members_update" on members;
create policy "members_update" on members for update
  using (
    zone_id = public.current_user_zone_id()
    and (
      id = public.current_member_id()
      or (public.current_user_can('manage_members') and church_id in (select public.current_user_scope_church_ids()))
    )
  )
  with check (
    zone_id = public.current_user_zone_id()
    and (
      id = public.current_member_id()
      or (public.current_user_can('manage_members') and church_id in (select public.current_user_scope_church_ids()))
    )
  );
drop policy if exists "members_delete" on members;
create policy "members_delete" on members for delete
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_members')
    and church_id in (select public.current_user_scope_church_ids())
  );

-- giving_entries: individual rows need view_giving_individual within scope
-- (or are the member's own). Everyone else gets chapter totals through
-- giving_totals_in_scope() and never sees a person's amounts.
drop policy if exists "giving_entries_select" on giving_entries;
create policy "giving_entries_select" on giving_entries for select
  using (
    zone_id = public.current_user_zone_id()
    and (
      member_id = public.current_member_id()
      or (
        public.current_user_can('view_giving_individual')
        and exists (
          select 1 from public.members m
          where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids())
        )
      )
    )
  );
drop policy if exists "giving_entries_insert" on giving_entries;
create policy "giving_entries_insert" on giving_entries for insert
  with check (
    zone_id = public.current_user_zone_id()
    and (public.current_user_can('import_giving') or public.current_user_can('manage_members'))
    and exists (
      select 1 from public.members m
      where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids())
    )
  );
drop policy if exists "giving_entries_update" on giving_entries;
create policy "giving_entries_update" on giving_entries for update
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('import_giving')
    and exists (
      select 1 from public.members m
      where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids())
    )
  )
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('import_giving')
    and exists (
      select 1 from public.members m
      where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids())
    )
  );
drop policy if exists "giving_entries_delete" on giving_entries;
create policy "giving_entries_delete" on giving_entries for delete
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('import_giving')
    and exists (
      select 1 from public.members m
      where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids())
    )
  );

-- trainings: leaders see the trainings of members in their scope; a member
-- sees and updates only their own row's progress (that's what lets them mark
-- a training in-progress/completed after watching its video).
drop policy if exists "trainings_select" on trainings;
create policy "trainings_select" on trainings for select
  using (
    zone_id = public.current_user_zone_id()
    and (
      member_id = public.current_member_id()
      or (
        public.current_user_can('view_members')
        and exists (
          select 1 from public.members m
          where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids())
        )
      )
    )
  );
drop policy if exists "trainings_insert" on trainings;
create policy "trainings_insert" on trainings for insert
  with check (
    zone_id = public.current_user_zone_id()
    and (public.current_user_can('manage_training') or public.current_user_can('manage_members'))
    and exists (
      select 1 from public.members m
      where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids())
    )
  );
drop policy if exists "trainings_update" on trainings;
create policy "trainings_update" on trainings for update
  using (
    zone_id = public.current_user_zone_id()
    and (
      member_id = public.current_member_id()
      or (
        public.current_user_can('manage_training')
        and exists (
          select 1 from public.members m
          where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids())
        )
      )
    )
  )
  with check (
    zone_id = public.current_user_zone_id()
    and (
      member_id = public.current_member_id()
      or (
        public.current_user_can('manage_training')
        and exists (
          select 1 from public.members m
          where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids())
        )
      )
    )
  );
drop policy if exists "trainings_delete" on trainings;
create policy "trainings_delete" on trainings for delete
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_training')
    and exists (
      select 1 from public.members m
      where m.id = member_id and m.church_id in (select public.current_user_scope_church_ids())
    )
  );

-- audit_log: readable by whoever manages access, insertable by any leader's
-- action, and no update/delete policy at all — once written, a row is permanent.
drop policy if exists "audit_log_select" on audit_log;
create policy "audit_log_select" on audit_log for select
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'));
drop policy if exists "audit_log_insert" on audit_log;
create policy "audit_log_insert" on audit_log for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));

-- activity: leaders see activity in their scope (zone-level rows with no
-- chapter only for zone-level leaders). Not shown in the member portal.
drop policy if exists "activity_select" on activity;
create policy "activity_select" on activity for select
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('view_members')
    and (
      church_id in (select public.current_user_scope_church_ids())
      or (church_id is null and public.current_user_scope_level() = 'zone')
    )
  );
drop policy if exists "activity_insert" on activity;
create policy "activity_insert" on activity for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "activity_update" on activity;
create policy "activity_update" on activity for update
  using (zone_id = public.current_user_zone_id() and public.current_user_role() = 'super_admin')
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() = 'super_admin');
drop policy if exists "activity_delete" on activity;
create policy "activity_delete" on activity for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_role() = 'super_admin');

-- events: everyone in the zone (including members) can read the calendar.
-- Flagship editions (series_id set) are edited by manage_events; ordinary
-- events by manage_calendar — zone-wide ones only by zone-level leaders,
-- chapter ones within the caller's scope.
drop policy if exists "events_select" on events;
create policy "events_select" on events for select
  using (zone_id = public.current_user_zone_id());

create or replace function public.can_edit_event(e_series uuid, e_church uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select case
    when e_series is not null then public.current_user_can('manage_events')
    else public.current_user_can('manage_calendar')
      and (
        e_church in (select public.current_user_scope_church_ids())
        or (e_church is null and public.current_user_scope_level() = 'zone')
      )
  end
$$;

drop policy if exists "events_insert" on events;
create policy "events_insert" on events for insert
  with check (zone_id = public.current_user_zone_id() and public.can_edit_event(series_id, church_id));
drop policy if exists "events_update" on events;
create policy "events_update" on events for update
  using (zone_id = public.current_user_zone_id() and public.can_edit_event(series_id, church_id))
  with check (zone_id = public.current_user_zone_id() and public.can_edit_event(series_id, church_id));
drop policy if exists "events_delete" on events;
create policy "events_delete" on events for delete
  using (zone_id = public.current_user_zone_id() and public.can_edit_event(series_id, church_id));

-- event_series: everyone in the zone reads; manage_events writes.
drop policy if exists "event_series_select" on event_series;
create policy "event_series_select" on event_series for select
  using (zone_id = public.current_user_zone_id());
drop policy if exists "event_series_insert" on event_series;
create policy "event_series_insert" on event_series for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_events'));
drop policy if exists "event_series_update" on event_series;
create policy "event_series_update" on event_series for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_events'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_events'));

-- event_media: everyone in the zone reads; whoever may edit the parent event writes.
drop policy if exists "event_media_select" on event_media;
create policy "event_media_select" on event_media for select
  using (zone_id = public.current_user_zone_id());
drop policy if exists "event_media_insert" on event_media;
create policy "event_media_insert" on event_media for insert
  with check (
    zone_id = public.current_user_zone_id()
    and exists (
      select 1 from public.events e
      where e.id = event_id and public.can_edit_event(e.series_id, e.church_id)
    )
  );
drop policy if exists "event_media_update" on event_media;
create policy "event_media_update" on event_media for update
  using (
    zone_id = public.current_user_zone_id()
    and exists (
      select 1 from public.events e
      where e.id = event_id and public.can_edit_event(e.series_id, e.church_id)
    )
  )
  with check (zone_id = public.current_user_zone_id());
drop policy if exists "event_media_delete" on event_media;
create policy "event_media_delete" on event_media for delete
  using (
    zone_id = public.current_user_zone_id()
    and exists (
      select 1 from public.events e
      where e.id = event_id and public.can_edit_event(e.series_id, e.church_id)
    )
  );

-- ledger_entries / reconciliations: manage_ledger, within scope.
drop policy if exists "ledger_entries_select" on ledger_entries;
create policy "ledger_entries_select" on ledger_entries for select
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "ledger_entries_insert" on ledger_entries;
create policy "ledger_entries_insert" on ledger_entries for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "ledger_entries_update" on ledger_entries;
create policy "ledger_entries_update" on ledger_entries for update
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  )
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "ledger_entries_delete" on ledger_entries;
create policy "ledger_entries_delete" on ledger_entries for delete
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );

drop policy if exists "reconciliations_select" on reconciliations;
create policy "reconciliations_select" on reconciliations for select
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "reconciliations_insert" on reconciliations;
create policy "reconciliations_insert" on reconciliations for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "reconciliations_delete" on reconciliations;
create policy "reconciliations_delete" on reconciliations for delete
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Backfill for a database that existed before positions/scopes did, so
-- running this migration doesn't lock current logins out. (A fresh database
-- has no profiles yet, so this is a no-op there.)
-- ─────────────────────────────────────────────────────────────────────────
update profiles set
  position = 'zonal_director',
  scope = 'zone',
  caps = array['view_members','view_contact_details','manage_members','view_giving_totals','view_giving_individual','import_giving','manage_ledger','manage_training','manage_calendar','send_newsletter','view_reports','manage_access','manage_events']
where role = 'super_admin' and cardinality(caps) = 0;

update profiles set
  position = 'zonal_secretary',
  scope = 'zone',
  caps = array['view_members','view_contact_details','manage_members','view_giving_totals','view_giving_individual','import_giving','manage_ledger','manage_training','manage_calendar']
where role = 'admin' and cardinality(caps) = 0;

-- A capability added after logins already existed: give it to the positions
-- that hold it by default (Directors and Zonal Secretaries), unless it was
-- deliberately revoked for that person.
update profiles set caps = array_append(caps, 'manage_events')
where position in ('zonal_director', 'assistant_zonal_director', 'zonal_secretary')
  and not ('manage_events' = any(caps))
  and not ('manage_events' = any(revoked_caps));

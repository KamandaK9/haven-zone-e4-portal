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
alter table members add column if not exists title text;
alter table members add column if not exists kc_handle text;
alter table members add column if not exists profession text;
alter table members add column if not exists spouse_name text;
alter table members add column if not exists birthday text;
alter table members add column if not exists wedding_anniversary text;

create table if not exists giving_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  amount numeric(12, 2) not null,
  unique (member_id, month)
);

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

alter table zones enable row level security;
alter table profiles enable row level security;
alter table countries enable row level security;
alter table churches enable row level security;
alter table members enable row level security;
alter table giving_entries enable row level security;
alter table trainings enable row level security;
alter table training_programs enable row level security;
alter table activity enable row level security;
alter table events enable row level security;
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

-- countries / churches / training_programs: everyone in the zone (including
-- members) can read; only staff (super_admin/admin) can write. A member
-- needs read access to a program's video/description to act on their own
-- assigned training.
do $$
declare
  t text;
begin
  foreach t in array array['countries', 'churches', 'training_programs']
  loop
    execute format('drop policy if exists "%s_select" on %I', t, t);
    execute format(
      'create policy "%s_select" on %I for select using (zone_id = public.current_user_zone_id())',
      t, t
    );
    execute format('drop policy if exists "%s_insert" on %I', t, t);
    execute format(
      'create policy "%s_insert" on %I for insert with check (zone_id = public.current_user_zone_id() and public.current_user_role() in (''super_admin'', ''admin''))',
      t, t
    );
    execute format('drop policy if exists "%s_update" on %I', t, t);
    execute format(
      'create policy "%s_update" on %I for update using (zone_id = public.current_user_zone_id() and public.current_user_role() in (''super_admin'', ''admin'')) with check (zone_id = public.current_user_zone_id() and public.current_user_role() in (''super_admin'', ''admin''))',
      t, t
    );
    execute format('drop policy if exists "%s_delete" on %I', t, t);
    execute format(
      'create policy "%s_delete" on %I for delete using (zone_id = public.current_user_zone_id() and public.current_user_role() in (''super_admin'', ''admin''))',
      t, t
    );
  end loop;
end $$;

-- members: staff see/write every member in the zone; a 'member' login sees
-- and updates only their own linked row (app logic restricts that update to
-- contact-info fields — RLS itself can't scope by column).
drop policy if exists "members_select" on members;
create policy "members_select" on members for select
  using (
    zone_id = public.current_user_zone_id()
    and (public.current_user_role() in ('super_admin', 'admin') or id = public.current_member_id())
  );
drop policy if exists "members_insert" on members;
create policy "members_insert" on members for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "members_update" on members;
create policy "members_update" on members for update
  using (
    zone_id = public.current_user_zone_id()
    and (public.current_user_role() in ('super_admin', 'admin') or id = public.current_member_id())
  )
  with check (
    zone_id = public.current_user_zone_id()
    and (public.current_user_role() in ('super_admin', 'admin') or id = public.current_member_id())
  );
drop policy if exists "members_delete" on members;
create policy "members_delete" on members for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));

-- giving_entries: staff see/write everything; a member sees only rows tied
-- to their own linked member row, and never writes them.
drop policy if exists "giving_entries_select" on giving_entries;
create policy "giving_entries_select" on giving_entries for select
  using (
    zone_id = public.current_user_zone_id()
    and (public.current_user_role() in ('super_admin', 'admin') or member_id = public.current_member_id())
  );
drop policy if exists "giving_entries_insert" on giving_entries;
create policy "giving_entries_insert" on giving_entries for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "giving_entries_update" on giving_entries;
create policy "giving_entries_update" on giving_entries for update
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "giving_entries_delete" on giving_entries;
create policy "giving_entries_delete" on giving_entries for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));

-- trainings: staff assign (insert) and can update/delete any row; a member
-- sees only their own assigned trainings and may update (but not insert or
-- delete) their own row's progress — this is what lets a member mark a
-- training in-progress/completed themselves after watching its video.
drop policy if exists "trainings_select" on trainings;
create policy "trainings_select" on trainings for select
  using (
    zone_id = public.current_user_zone_id()
    and (public.current_user_role() in ('super_admin', 'admin') or member_id = public.current_member_id())
  );
drop policy if exists "trainings_insert" on trainings;
create policy "trainings_insert" on trainings for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "trainings_update" on trainings;
create policy "trainings_update" on trainings for update
  using (
    zone_id = public.current_user_zone_id()
    and (public.current_user_role() in ('super_admin', 'admin') or member_id = public.current_member_id())
  )
  with check (
    zone_id = public.current_user_zone_id()
    and (public.current_user_role() in ('super_admin', 'admin') or member_id = public.current_member_id())
  );
drop policy if exists "trainings_delete" on trainings;
create policy "trainings_delete" on trainings for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));

-- audit_log: staff-only read, staff-only insert, no update/delete policy at
-- all — once written, a row is permanent.
drop policy if exists "audit_log_select" on audit_log;
create policy "audit_log_select" on audit_log for select
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "audit_log_insert" on audit_log;
create policy "audit_log_insert" on audit_log for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));

-- activity: staff-only in both directions (not shown in the member portal).
drop policy if exists "activity_select" on activity;
create policy "activity_select" on activity for select
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "activity_insert" on activity;
create policy "activity_insert" on activity for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "activity_update" on activity;
create policy "activity_update" on activity for update
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "activity_delete" on activity;
create policy "activity_delete" on activity for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));

-- events: everyone in the zone (including members) can read the calendar;
-- only staff create/edit/delete events.
drop policy if exists "events_select" on events;
create policy "events_select" on events for select
  using (zone_id = public.current_user_zone_id());
drop policy if exists "events_insert" on events;
create policy "events_insert" on events for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "events_update" on events;
create policy "events_update" on events for update
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "events_delete" on events;
create policy "events_delete" on events for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));

-- ledger_entries: staff-only, full stop.
drop policy if exists "ledger_entries_select" on ledger_entries;
create policy "ledger_entries_select" on ledger_entries for select
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "ledger_entries_insert" on ledger_entries;
create policy "ledger_entries_insert" on ledger_entries for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "ledger_entries_update" on ledger_entries;
create policy "ledger_entries_update" on ledger_entries for update
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "ledger_entries_delete" on ledger_entries;
create policy "ledger_entries_delete" on ledger_entries for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));

-- reconciliations: staff-only, full stop — same as ledger_entries.
drop policy if exists "reconciliations_select" on reconciliations;
create policy "reconciliations_select" on reconciliations for select
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "reconciliations_insert" on reconciliations;
create policy "reconciliations_insert" on reconciliations for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "reconciliations_delete" on reconciliations;
create policy "reconciliations_delete" on reconciliations for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));

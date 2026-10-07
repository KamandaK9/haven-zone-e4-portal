-- Attendance (Stratum core): services, check-ins, first-timers and
-- follow-ups. Check-ins are made on devices that may be offline, so an
-- attendance row's id is generated on the device and a member can only be
-- checked in to a service once — syncing the same check-in again, or from a
-- second device, changes nothing. Idempotent: safe to re-run.

-- A first-timer checked in at a service, before anyone has confirmed them
-- as a member.
alter table members add column if not exists is_visitor boolean not null default false;

-- ─────────────────────────────────────────────────────────────────────────
-- Services: one gathering at one location on one day. A device creates the
-- service it's checking people into (by location + date + kind + name), so
-- the same service is never made twice.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  service_date date not null,
  kind text not null default 'sunday' check (kind in ('sunday', 'midweek', 'special')),
  name text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (church_id, service_date, kind, name)
);
create index if not exists services_church_date_idx on services(church_id, service_date desc);

create table if not exists attendance (
  id uuid primary key, -- generated on the checking-in device
  zone_id uuid not null references zones(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  checked_in_at timestamptz not null default now(), -- device time
  checked_in_by uuid references profiles(id) on delete set null,
  device_id text,
  synced_at timestamptz not null default now(),
  unique (service_id, member_id)
);
create index if not exists attendance_member_idx on attendance(member_id);

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  outcome text not null default 'reached' check (outcome in ('reached', 'no_answer', 'visited', 'other')),
  note text
);
create index if not exists follow_ups_member_idx on follow_ups(member_id, created_at desc);

-- Members in the caller's scope, cell-scoped logins narrowed to their own
-- cell — who a cell leader's attendance and follow-ups cover.
create or replace function public.current_user_scope_member_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select m.id
  from public.members m
  join public.profiles p on p.id = auth.uid() and p.zone_id = m.zone_id
  where m.church_id in (select public.current_user_scope_church_ids())
    and (p.scope <> 'cell' or m.cell_id in (select public.current_user_scope_cell_ids()))
$$;

-- A member's location, for policies whose caller can't read members (a
-- check-in volunteer) — a subquery on members would see nothing under RLS.
create or replace function public.member_church_id(p_member_id uuid)
returns uuid
language sql security definer stable set search_path = public
as $$
  select church_id from public.members where id = p_member_id
$$;

alter table services enable row level security;
alter table attendance enable row level security;
alter table follow_ups enable row level security;

drop policy if exists "services_select" on services;
create policy "services_select" on services for select
  using (zone_id = public.current_user_zone_id() and church_id in (select public.current_user_scope_church_ids()));
-- Whoever checks people in may open the service they're checking into.
drop policy if exists "services_insert" on services;
create policy "services_insert" on services for insert
  with check (
    zone_id = public.current_user_zone_id()
    and (public.current_user_can('manage_services') or public.current_user_can('check_in'))
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "services_update" on services;
create policy "services_update" on services for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_services')
         and church_id in (select public.current_user_scope_church_ids()));
drop policy if exists "services_delete" on services;
create policy "services_delete" on services for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_services')
         and church_id in (select public.current_user_scope_church_ids()));

drop policy if exists "attendance_select" on attendance;
create policy "attendance_select" on attendance for select
  using (
    zone_id = public.current_user_zone_id()
    and (
      member_id = public.current_member_id()
      or (public.current_user_can('check_in')
          and service_id in (select id from services where church_id in (select public.current_user_scope_church_ids())))
      or (public.current_user_can('view_attendance') and member_id in (select public.current_user_scope_member_ids()))
    )
  );
drop policy if exists "attendance_insert" on attendance;
create policy "attendance_insert" on attendance for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('check_in')
    and service_id in (select id from services where church_id in (select public.current_user_scope_church_ids()))
    and public.member_church_id(member_id) in (select public.current_user_scope_church_ids())
  );
-- Undoing a mistaken check-in.
drop policy if exists "attendance_delete" on attendance;
create policy "attendance_delete" on attendance for delete
  using (
    zone_id = public.current_user_zone_id()
    and (public.current_user_can('check_in') or public.current_user_can('manage_services'))
    and service_id in (select id from services where church_id in (select public.current_user_scope_church_ids()))
  );

drop policy if exists "follow_ups_select" on follow_ups;
create policy "follow_ups_select" on follow_ups for select
  using (
    zone_id = public.current_user_zone_id()
    and (public.current_user_can('record_follow_up') or public.current_user_can('view_pastoral_notes'))
    and member_id in (select public.current_user_scope_member_ids())
  );
drop policy if exists "follow_ups_insert" on follow_ups;
create policy "follow_ups_insert" on follow_ups for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('record_follow_up')
    and member_id in (select public.current_user_scope_member_ids())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Check-in lookups. A check-in volunteer can't read the members table (no
-- view_members), so these hand them only what check-in needs — never
-- contact details — for a location in their scope.
-- ─────────────────────────────────────────────────────────────────────────
drop function if exists public.checkin_roster(uuid);
create or replace function public.checkin_roster(p_church_id uuid)
returns table (id uuid, first_name text, last_name text, cell_name text, age_group text, is_visitor boolean)
language sql security definer stable set search_path = public
as $$
  select m.id, m.first_name, m.last_name, cl.name, m.age_group, m.is_visitor
  from public.members m
  left join public.cells cl on cl.id = m.cell_id
  where m.church_id = p_church_id
    and public.current_user_can('check_in')
    and p_church_id in (select public.current_user_scope_church_ids())
$$;

-- Adds a first-timer at check-in. The id comes from the device, so a retried
-- sync finds the row it already made instead of adding them twice.
create or replace function public.checkin_add_visitor(
  p_id uuid, p_church_id uuid, p_first_name text, p_last_name text, p_phone text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_zone uuid := public.current_user_zone_id();
  v_country uuid;
begin
  if not public.current_user_can('check_in') or p_church_id not in (select public.current_user_scope_church_ids()) then
    raise exception 'Not permitted';
  end if;
  if exists (select 1 from public.members where id = p_id) then
    return p_id;
  end if;
  select country_id into v_country from public.churches where id = p_church_id and zone_id = v_zone;
  insert into public.members (id, zone_id, church_id, country_id, first_name, last_name, phone, is_visitor, join_date)
  values (p_id, v_zone, p_church_id, v_country, trim(p_first_name), coalesce(trim(p_last_name), ''),
          nullif(trim(coalesce(p_phone, '')), ''), true, current_date);
  return p_id;
end;
$$;

grant execute on function public.checkin_roster(uuid) to authenticated;
grant execute on function public.checkin_add_visitor(uuid, uuid, text, text, text) to authenticated;

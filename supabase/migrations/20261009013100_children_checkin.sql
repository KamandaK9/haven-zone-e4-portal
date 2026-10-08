-- Children's check-in with pick-up codes (Stratum core): staff check a child
-- in with their guardian's details and a short code; the child is only
-- released against that code (or a typed reason). A check-in also counts as
-- the child's attendance at the service. Idempotent.

-- A pick-up message (the code, to the guardian) is a kind of message.
alter table messages drop constraint if exists messages_kind_check;
alter table messages add constraint messages_kind_check check (kind in ('manual', 'birthday', 'welcome', 'missed', 'pickup'));

create table if not exists child_checkins (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  child_id uuid not null references members(id) on delete cascade,
  -- The child's name as checked in, so staff who can't read members see it.
  child_name text not null default '',
  guardian_name text not null check (char_length(guardian_name) between 1 and 120),
  guardian_phone text check (guardian_phone is null or char_length(guardian_phone) <= 32),
  pickup_code text not null check (pickup_code ~ '^[0-9]{4}$'),
  notes text check (notes is null or char_length(notes) <= 300), -- e.g. allergies
  checked_in_at timestamptz not null default now(),
  checked_in_by uuid references profiles(id) on delete set null,
  checked_out_at timestamptz,
  checked_out_by uuid references profiles(id) on delete set null,
  -- Set when a child was released without the code, with why.
  override_reason text check (override_reason is null or char_length(override_reason) <= 300),
  unique (service_id, child_id)
);
create index if not exists child_checkins_service_idx on child_checkins(service_id) where checked_out_at is null;

alter table child_checkins enable row level security;

drop policy if exists "child_checkins_select" on child_checkins;
create policy "child_checkins_select" on child_checkins for select
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('check_in')
    and service_id in (select id from services where church_id in (select public.current_user_scope_church_ids()))
  );
drop policy if exists "child_checkins_insert" on child_checkins;
create policy "child_checkins_insert" on child_checkins for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('check_in')
    and checked_in_by = auth.uid()
    and checked_out_at is null
    and service_id in (select id from services where church_id in (select public.current_user_scope_church_ids()))
    and public.member_church_id(child_id) in (select public.current_user_scope_church_ids())
  );
-- Releasing a child: only the release columns can change.
drop policy if exists "child_checkins_update" on child_checkins;
create policy "child_checkins_update" on child_checkins for update
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('check_in')
    and service_id in (select id from services where church_id in (select public.current_user_scope_church_ids()))
  )
  with check (zone_id = public.current_user_zone_id());

-- The children at a location with their guardian's details, for staff who
-- can't read the members table (no view_members) — only the age groups asked
-- for (the children's church ones), nothing else about them.
create or replace function public.children_roster(p_church_id uuid, p_age_groups text[])
returns table (id uuid, first_name text, last_name text, age_group text, guardian_name text, guardian_phone text)
language sql security definer stable set search_path = public
as $$
  select m.id, m.first_name, m.last_name, m.age_group, m.guardian_name, m.guardian_phone
  from public.members m
  where m.church_id = p_church_id
    and m.age_group = any(p_age_groups)
    and public.current_user_can('check_in')
    and p_church_id in (select public.current_user_scope_church_ids())
$$;
grant execute on function public.children_roster(uuid, text[]) to authenticated;

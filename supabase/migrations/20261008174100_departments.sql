-- Departments (Stratum core): the areas people serve in — choir, ushering,
-- media… A label, not access: belonging to a department shows on a member's
-- profile and can be filtered on, nothing more. The organisation defines the
-- list (Settings → Departments); a member can be in several. Idempotent.

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (zone_id, name)
);

create table if not exists member_departments (
  member_id uuid not null references members(id) on delete cascade,
  department_id uuid not null references departments(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  primary key (member_id, department_id)
);
create index if not exists member_departments_department_idx on member_departments(department_id);

alter table departments enable row level security;
alter table member_departments enable row level security;

drop policy if exists "departments_select" on departments;
create policy "departments_select" on departments for select using (zone_id = public.current_user_zone_id());
drop policy if exists "departments_write" on departments;
create policy "departments_write" on departments for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_settings'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_settings'));

-- Who's in a department follows who can see the member; changing it follows
-- who can manage them.
drop policy if exists "member_departments_select" on member_departments;
create policy "member_departments_select" on member_departments for select
  using (
    zone_id = public.current_user_zone_id()
    and (member_id = public.current_member_id()
         or (public.current_user_can('view_members') and member_id in (select public.current_user_scope_member_ids())))
  );
drop policy if exists "member_departments_write" on member_departments;
create policy "member_departments_write" on member_departments for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_members')
         and member_id in (select public.current_user_scope_member_ids()))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_members')
              and member_id in (select public.current_user_scope_member_ids()));

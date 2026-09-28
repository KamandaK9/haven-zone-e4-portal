-- Adds a "cell" scope, for tenants with a leadership tier assigned to one
-- cell rather than a whole chapter (see PositionDef.scope in src/lib/tenant.ts).
-- Existing zone/sub_zone/chapter/self scopes are unchanged.

alter table profiles drop constraint if exists profiles_scope_check;
alter table profiles add constraint profiles_scope_check
  check (scope in ('zone', 'sub_zone', 'chapter', 'cell', 'self'));

alter table profiles add column if not exists cell_id uuid references cells(id) on delete set null;

-- A cell-scoped login still resolves to its own chapter for chapter-level
-- reads (e.g. giving_totals_in_scope), same as a Governor.
create or replace function public.current_user_scope_church_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select c.id
  from public.churches c
  join public.profiles p on p.id = auth.uid() and p.zone_id = c.zone_id
  where p.scope = 'zone'
     or (p.scope = 'sub_zone' and c.sub_zone_id is not null and c.sub_zone_id = p.sub_zone_id)
     or (p.scope in ('chapter', 'cell') and c.id = p.church_id)
$$;

-- The cells the caller may see: every cell in the zone/sub-zone/chapter
-- they're scoped to, or just their own cell. Attendance, follow-ups and
-- course cohorts key off this rather than current_user_scope_church_ids()
-- when a cell leader must not see other cells in their own chapter.
create or replace function public.current_user_scope_cell_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select cl.id
  from public.cells cl
  join public.profiles p on p.id = auth.uid() and p.zone_id = cl.zone_id
  where p.scope = 'zone'
     or (p.scope = 'sub_zone' and cl.church_id in (
           select id from public.churches where sub_zone_id = p.sub_zone_id
         ))
     or (p.scope in ('chapter', 'cell') and cl.church_id = p.church_id and (p.scope = 'chapter' or cl.id = p.cell_id))
$$;

-- Follow-up tasks (Stratum core): a member who needs contact, assigned to a
-- leader with a due date, that the leader works through and marks done by
-- recording how it went (which writes the usual follow-up). An assignee must
-- be someone who can see that member. Idempotent.

create table if not exists follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  assigned_to uuid not null references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id) on delete set null,
  assigned_by_name text,
  due_date date not null,
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_follow_up uuid references follow_ups(id) on delete set null
);
create index if not exists follow_up_tasks_assignee_idx on follow_up_tasks(assigned_to, status, due_date);
create index if not exists follow_up_tasks_member_idx on follow_up_tasks(member_id);

-- Whether a given login can see a member, by the same rules as everyone's
-- own scope (zone / sub-zone / chapter, or a cell role's cells and the
-- cells inside them).
create or replace function public.profile_covers_member(p_profile uuid, p_member uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.members m on m.id = p_member and m.zone_id = p.zone_id
    where p.id = p_profile
      and (
        p.scope = 'zone'
        or (p.scope = 'sub_zone' and exists (select 1 from public.churches c where c.id = m.church_id and c.sub_zone_id = p.sub_zone_id))
        or (p.scope = 'chapter' and p.church_id = m.church_id)
        or (p.scope = 'cell' and m.cell_id is not null and exists (
              select 1 from public.cells cl
              where cl.id = m.cell_id and (
                cl.leader_member_id in (select id from public.members where profile_id = p.id)
                or cl.id in (select cell_id from public.members where profile_id = p.id and cell_id is not null)
                or cl.parent_id in (
                  select c2.id from public.cells c2
                  where c2.leader_member_id in (select id from public.members where profile_id = p.id)
                     or c2.id in (select cell_id from public.members where profile_id = p.id and cell_id is not null))
              )))
      )
  )
$$;

-- Whether the caller may hand this member's follow-up to this login: they
-- record follow-ups, can see the member, and so can the assignee. The raw
-- helper above stays private; this is what the policy uses.
create or replace function public.can_assign_follow_up(p_assignee uuid, p_member uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select public.current_user_can('record_follow_up')
    and p_member in (select public.current_user_scope_member_ids())
    and public.profile_covers_member(p_assignee, p_member)
$$;

-- The leaders a member's follow-up could go to: logins that can record
-- follow-ups and see the member. Only for someone who could assign it.
create or replace function public.follow_up_assignees(p_member uuid)
returns table (id uuid, full_name text, "position" text)
language sql security definer stable set search_path = public
as $$
  select p.id, p.full_name, p."position"
  from public.profiles p
  where public.current_user_can('record_follow_up')
    and p_member in (select public.current_user_scope_member_ids())
    and p.zone_id = public.current_user_zone_id()
    and p.role <> 'member'
    and 'record_follow_up' = any(p.caps)
    and public.profile_covers_member(p.id, p_member)
  order by p.full_name
$$;

alter table follow_up_tasks enable row level security;

-- Your own tasks, and tasks for anyone in your area (so pastors can see
-- what's outstanding).
drop policy if exists "follow_up_tasks_select" on follow_up_tasks;
create policy "follow_up_tasks_select" on follow_up_tasks for select
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('record_follow_up')
    and (assigned_to = auth.uid() or member_id in (select public.current_user_scope_member_ids()))
  );
-- Assigning: someone who records follow-ups, for a member they can see, to a
-- login that can see that member too.
drop policy if exists "follow_up_tasks_insert" on follow_up_tasks;
create policy "follow_up_tasks_insert" on follow_up_tasks for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('record_follow_up')
    and assigned_by = auth.uid()
    and public.can_assign_follow_up(assigned_to, member_id)
  );
-- Finishing or cancelling: the assignee, or someone who can see the member.
drop policy if exists "follow_up_tasks_update" on follow_up_tasks;
create policy "follow_up_tasks_update" on follow_up_tasks for update
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('record_follow_up')
    and (assigned_to = auth.uid() or member_id in (select public.current_user_scope_member_ids()))
  )
  with check (zone_id = public.current_user_zone_id());

revoke all on function public.profile_covers_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.profile_covers_member(uuid, uuid) to service_role;
grant execute on function public.follow_up_assignees(uuid) to authenticated;
grant execute on function public.can_assign_follow_up(uuid, uuid) to authenticated;

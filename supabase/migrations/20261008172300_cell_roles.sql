-- Cell-level roles (Stratum core): who a cell-scoped login covers, from what
-- the organisation already keeps — the cells they lead (cells.leader_member_id)
-- or belong to (their member row's cell), and every cell inside those. So a
-- senior cell's leader covers its cells, a cell leader their cell, and an
-- assistant the cell they're in — no separate "which cell" setting that
-- nothing fills in (profiles.cell_id). Idempotent.

create or replace function public.current_user_scope_cell_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  with p as (
    select * from public.profiles where id = auth.uid()
  ),
  me as (
    select m.id, m.cell_id from public.members m where m.profile_id = auth.uid()
  ),
  mine as (
    select cl.id
    from public.cells cl, p
    where p.scope = 'cell' and cl.zone_id = p.zone_id
      and (cl.leader_member_id in (select id from me) or cl.id in (select cell_id from me))
  )
  select cl.id
  from public.cells cl
  join p on p.zone_id = cl.zone_id
  where p.scope = 'zone'
     or (p.scope = 'sub_zone' and cl.church_id in (select id from public.churches where sub_zone_id = p.sub_zone_id))
     or (p.scope = 'chapter' and cl.church_id = p.church_id)
     or (p.scope = 'cell' and (cl.id in (select id from mine) or cl.parent_id in (select id from mine)))
$$;

-- Members: a cell-scoped leader now sees the members of their cells only,
-- not their whole location (everyone else is unchanged: their scope's
-- locations). current_user_scope_member_ids() is that rule.
drop policy if exists "members_select" on members;
create policy "members_select" on members for select
  using (
    zone_id = public.current_user_zone_id()
    and (
      id = public.current_member_id()
      or (public.current_user_can('view_members') and id in (select public.current_user_scope_member_ids()))
    )
  );

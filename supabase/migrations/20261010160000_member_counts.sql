-- Members per location, for pages that show counts without loading every
-- member (the structure pages). Runs as the caller, so RLS decides which
-- members are counted — the same ones the caller could load.
create or replace function public.member_counts_in_scope()
returns table (church_id uuid, total bigint, visitors bigint)
language sql stable security invoker set search_path = public
as $$
  select m.church_id, count(*), count(*) filter (where m.is_visitor)
  from public.members m
  where m.zone_id = public.current_user_zone_id()
  group by m.church_id
$$;

revoke execute on function public.member_counts_in_scope() from anon, public;
grant execute on function public.member_counts_in_scope() to authenticated, service_role;

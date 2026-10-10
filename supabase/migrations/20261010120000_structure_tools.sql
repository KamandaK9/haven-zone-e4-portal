-- Tools for tidying the structure after an import (Stratum core): fix a
-- location's country, move it between sub-zones, merge two locations that are
-- really one. For the Directors, and anyone they give manage_settings (e.g. a
-- secretary doing the data clean-up). Idempotent.

create or replace function public.can_change_structure()
returns boolean
language sql security definer stable set search_path = public
as $$
  select public.current_user_role() = 'super_admin' or public.current_user_can('manage_settings')
$$;

-- The functions below make several related changes at once; while they run,
-- the guard triggers treat them as trusted. The setting is transaction-local
-- and can't be set through the API (pg_catalog isn't exposed).
create or replace function public.is_trusted_writer()
returns boolean
language sql stable
as $$
  select coalesce(auth.jwt() ->> 'role', 'service_role') = 'service_role'
      or coalesce(current_setting('stratum.trusted_writer', true), '') = 'on'
$$;

-- Sub-zones, countries and leadership history: same people.
do $$
declare
  t text;
begin
  foreach t in array array['countries', 'sub_zones']
  loop
    execute format('drop policy if exists "%s_insert" on %I', t, t);
    execute format('create policy "%s_insert" on %I for insert with check (zone_id = public.current_user_zone_id() and public.can_change_structure())', t, t);
    execute format('drop policy if exists "%s_update" on %I', t, t);
    execute format(
      'create policy "%s_update" on %I for update using (zone_id = public.current_user_zone_id() and public.can_change_structure()) with check (zone_id = public.current_user_zone_id() and public.can_change_structure())',
      t, t
    );
    execute format('drop policy if exists "%s_delete" on %I', t, t);
    execute format('create policy "%s_delete" on %I for delete using (zone_id = public.current_user_zone_id() and public.can_change_structure())', t, t);
  end loop;
end $$;

drop policy if exists "position_history_insert" on position_history;
create policy "position_history_insert" on position_history for insert
  with check (zone_id = public.current_user_zone_id() and public.can_change_structure() and manual);
drop policy if exists "position_history_update" on position_history;
create policy "position_history_update" on position_history for update
  using (zone_id = public.current_user_zone_id() and public.can_change_structure())
  with check (zone_id = public.current_user_zone_id() and public.can_change_structure());
drop policy if exists "position_history_delete" on position_history;
create policy "position_history_delete" on position_history for delete
  using (zone_id = public.current_user_zone_id() and public.can_change_structure());

-- Leadership history isn't changed by a merge: people keep their entries,
-- which move to the location they were merged into.
create or replace function public.record_position_history()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_sub uuid;
begin
  if coalesce(current_setting('stratum.merging', true), '') = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    update position_history set ended_on = current_date where member_id = old.id and ended_on is null and not manual;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.position is not distinct from old.position and new.church_id is not distinct from old.church_id then
      if new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name then
        update position_history set member_name = left(trim(new.first_name || ' ' || new.last_name), 200)
          where member_id = new.id and ended_on is null and not manual;
      end if;
      return new;
    end if;
    delete from position_history where member_id = new.id and ended_on is null and not manual and started_on = current_date;
    update position_history set ended_on = current_date where member_id = new.id and ended_on is null and not manual;
  end if;

  if new.position <> 'member' then
    select sub_zone_id into v_sub from churches where id = new.church_id;
    insert into position_history (zone_id, member_id, member_name, position, church_id, sub_zone_id, started_on)
    values (new.zone_id, new.id, left(coalesce(nullif(trim(new.first_name || ' ' || new.last_name), ''), 'Unnamed'), 200),
            new.position, new.church_id, v_sub, current_date);
  end if;
  return new;
end;
$$;

-- Checks a location belongs to the caller's zone, for the functions below.
create or replace function public.structure_church(p_church uuid)
returns churches
language plpgsql security definer stable set search_path = public
as $$
declare
  c churches;
begin
  select * into c from churches where id = p_church and zone_id = public.current_user_zone_id();
  if c.id is null then
    raise exception 'That location no longer exists.' using errcode = 'no_data_found';
  end if;
  return c;
end;
$$;

-- A location's country, and its members' with it.
create or replace function public.set_church_country(p_church uuid, p_country uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c churches;
begin
  if not public.can_change_structure() then
    raise exception 'Not permitted.' using errcode = 'insufficient_privilege';
  end if;
  c := public.structure_church(p_church);
  if not exists (select 1 from countries where id = p_country and zone_id = c.zone_id) then
    raise exception 'That country no longer exists.' using errcode = 'no_data_found';
  end if;
  perform set_config('stratum.trusted_writer', 'on', true);
  update churches set country_id = p_country where id = c.id;
  update members set country_id = p_country where church_id = c.id;
  perform set_config('stratum.trusted_writer', 'off', true);
end;
$$;

-- Into a sub-zone, or out of any (null).
create or replace function public.set_church_sub_zone(p_church uuid, p_sub_zone uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  c churches;
begin
  if not public.can_change_structure() then
    raise exception 'Not permitted.' using errcode = 'insufficient_privilege';
  end if;
  c := public.structure_church(p_church);
  if p_sub_zone is not null and not exists (select 1 from sub_zones where id = p_sub_zone and zone_id = c.zone_id) then
    raise exception 'That sub-zone no longer exists.' using errcode = 'no_data_found';
  end if;
  perform set_config('stratum.trusted_writer', 'on', true);
  update churches set sub_zone_id = p_sub_zone where id = c.id;
  perform set_config('stratum.trusted_writer', 'off', true);
end;
$$;

-- Two locations that are really one: everything recorded against p_from —
-- members, cells, records, logins' scope, leadership history … every
-- church_id column — moves to p_into, then p_from is removed. Returns how
-- many members moved.
create or replace function public.merge_churches(p_from uuid, p_into uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  f churches;
  t churches;
  col record;
  moved int;
begin
  if not public.can_change_structure() then
    raise exception 'Not permitted.' using errcode = 'insufficient_privilege';
  end if;
  if p_from = p_into then
    raise exception 'Choose a different location to merge into.' using errcode = 'invalid_parameter_value';
  end if;
  f := public.structure_church(p_from);
  t := public.structure_church(p_into);
  select count(*) into moved from members where church_id = f.id;

  perform set_config('stratum.trusted_writer', 'on', true);
  perform set_config('stratum.merging', 'on', true);
  begin
    for col in
      select c.table_name, c.column_name, c.data_type
      from information_schema.columns c
      join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
      where c.table_schema = 'public'
        and c.table_name <> 'churches'
        and (
          (c.column_name like '%church_id' and c.data_type = 'uuid')
          or (c.column_name like '%church_ids' and c.data_type = 'ARRAY' and c.udt_name = '_uuid')
        )
    loop
      if col.data_type = 'uuid' then
        execute format('update %I set %I = $1 where %I = $2', col.table_name, col.column_name, col.column_name) using t.id, f.id;
      else
        execute format(
          'update %I set %I = array(select distinct x from unnest(array_replace(%I, $2, $1)) x) where $2 = any(%I)',
          col.table_name, col.column_name, col.column_name, col.column_name
        ) using t.id, f.id;
      end if;
    end loop;
  exception
    when unique_violation or check_violation then
      raise exception 'Both locations have records that clash (e.g. the same service on the same day, or cheque files). Tidy those first, then merge.'
        using errcode = 'unique_violation';
  end;
  update members set country_id = t.country_id where church_id = t.id and country_id is distinct from t.country_id;
  update position_history set sub_zone_id = t.sub_zone_id where church_id = t.id and ended_on is null and not manual;
  delete from churches where id = f.id;
  perform set_config('stratum.merging', 'off', true);
  perform set_config('stratum.trusted_writer', 'off', true);
  return moved;
end;
$$;

revoke execute on function public.can_change_structure() from anon, public;
revoke execute on function public.structure_church(uuid) from anon, public, authenticated;
revoke execute on function public.set_church_country(uuid, uuid) from anon, public;
revoke execute on function public.set_church_sub_zone(uuid, uuid) from anon, public;
revoke execute on function public.merge_churches(uuid, uuid) from anon, public;
grant execute on function public.can_change_structure() to authenticated, service_role;
grant execute on function public.set_church_country(uuid, uuid) to authenticated, service_role;
grant execute on function public.set_church_sub_zone(uuid, uuid) to authenticated, service_role;
grant execute on function public.merge_churches(uuid, uuid) to authenticated, service_role;

-- QR check-in (Stratum core): people check themselves in on their own phone
-- by scanning a code for the service and entering their phone number. Each
-- service gets one unguessable link that expires after the service day. The
-- public page never talks to the database directly: these functions run
-- only for the server (service_role), which rate-limits every attempt first,
-- so the code can't be used to look up numbers in bulk. Idempotent.

create table if not exists check_in_links (
  token text primary key, -- random, unguessable; the QR code's URL
  zone_id uuid not null references zones(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  service_date date not null,
  kind text not null check (kind in ('sunday', 'midweek', 'special')),
  name text not null default '',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (church_id, service_date, kind, name)
);

alter table check_in_links enable row level security;

-- Whoever can check people in at a location can make (and see) its links.
drop policy if exists "check_in_links_select" on check_in_links;
create policy "check_in_links_select" on check_in_links for select
  using (zone_id = public.current_user_zone_id() and public.current_user_can('check_in')
         and church_id in (select public.current_user_scope_church_ids()));
drop policy if exists "check_in_links_insert" on check_in_links;
create policy "check_in_links_insert" on check_in_links for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('check_in')
              and church_id in (select public.current_user_scope_church_ids()));

-- Last nine digits: "+27 82 123 4567", "0821234567" and "27821234567" match.
create or replace function public.phone_key(p text)
returns text
language sql immutable
as $$
  select nullif(right(regexp_replace(coalesce(p, ''), '\D', '', 'g'), 9), '')
$$;

-- What the public page shows about a link: the service, nothing else.
create or replace function public.qr_link_info(p_token text)
returns table (zone_id uuid, church_name text, service_date date, kind text, name text)
language sql security definer stable set search_path = public
as $$
  select l.zone_id, c.name, l.service_date, l.kind, l.name
  from public.check_in_links l
  join public.churches c on c.id = l.church_id
  where l.token = p_token and l.expires_at > now()
$$;

-- The service a link checks people into, created on first use.
create or replace function public.qr_service_id(l public.check_in_links)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.services (zone_id, church_id, service_date, kind, name, created_by)
  values (l.zone_id, l.church_id, l.service_date, l.kind, l.name, l.created_by)
  on conflict (church_id, service_date, kind, name) do nothing;
  select id into v_id from public.services
  where church_id = l.church_id and service_date = l.service_date and kind = l.kind and name = l.name;
  return v_id;
end;
$$;

-- Checks someone in by phone number. Returns
--   {status: "checked_in" | "already", first_name}   on a single match,
--   {status: "choose", choices: [{id, first_name}]}   when a number is shared
--                                                     (only first names),
--   {status: "not_found"} or {status: "expired"}.
-- p_member_id picks one of the "choose" people; it must share that number.
create or replace function public.qr_check_in(p_token text, p_phone text, p_member_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  l public.check_in_links;
  v_key text := public.phone_key(p_phone);
  v_matches jsonb;
  v_count int;
  v_member public.members;
  v_service uuid;
  v_inserted int;
begin
  select * into l from public.check_in_links where token = p_token and expires_at > now();
  if not found then
    return jsonb_build_object('status', 'expired');
  end if;
  if v_key is null or length(v_key) < 9 then
    return jsonb_build_object('status', 'not_found');
  end if;

  select count(*), coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'first_name', m.first_name) order by m.first_name), '[]')
    into v_count, v_matches
  from public.members m
  where m.church_id = l.church_id and public.phone_key(m.phone) = v_key
    and (p_member_id is null or m.id = p_member_id);

  if v_count = 0 then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_count > 1 then
    return jsonb_build_object('status', 'choose', 'choices', v_matches);
  end if;

  select * into v_member from public.members m
  where m.church_id = l.church_id and public.phone_key(m.phone) = v_key
    and (p_member_id is null or m.id = p_member_id);
  v_service := public.qr_service_id(l);
  insert into public.attendance (id, zone_id, service_id, member_id, device_id)
  values (gen_random_uuid(), l.zone_id, v_service, v_member.id, 'qr')
  on conflict (service_id, member_id) do nothing;
  get diagnostics v_inserted = row_count;
  return jsonb_build_object('status', case when v_inserted > 0 then 'checked_in' else 'already' end, 'first_name', v_member.first_name);
end;
$$;

-- A first-timer checking in by QR. If their number already belongs to
-- someone at this location, they're sent back to check in by number instead.
create or replace function public.qr_add_visitor(p_token text, p_first_name text, p_last_name text, p_phone text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  l public.check_in_links;
  v_country uuid;
  v_member uuid;
  v_service uuid;
begin
  select * into l from public.check_in_links where token = p_token and expires_at > now();
  if not found then
    return jsonb_build_object('status', 'expired');
  end if;
  if coalesce(trim(p_first_name), '') = '' or char_length(p_first_name) > 80 or char_length(coalesce(p_last_name, '')) > 80 then
    return jsonb_build_object('status', 'invalid');
  end if;
  if public.phone_key(p_phone) is not null
     and exists (select 1 from public.members m where m.church_id = l.church_id and public.phone_key(m.phone) = public.phone_key(p_phone)) then
    return jsonb_build_object('status', 'known_number');
  end if;

  select country_id into v_country from public.churches where id = l.church_id;
  insert into public.members (zone_id, church_id, country_id, first_name, last_name, phone, is_visitor, join_date)
  values (l.zone_id, l.church_id, v_country, trim(p_first_name), coalesce(trim(p_last_name), ''),
          nullif(trim(coalesce(p_phone, '')), ''), true, l.service_date)
  returning id into v_member;
  v_service := public.qr_service_id(l);
  insert into public.attendance (id, zone_id, service_id, member_id, device_id)
  values (gen_random_uuid(), l.zone_id, v_service, v_member, 'qr');
  return jsonb_build_object('status', 'checked_in', 'first_name', trim(p_first_name));
end;
$$;

revoke all on function public.qr_link_info(text) from public, anon, authenticated;
revoke all on function public.qr_service_id(public.check_in_links) from public, anon, authenticated;
revoke all on function public.qr_check_in(text, text, uuid) from public, anon, authenticated;
revoke all on function public.qr_add_visitor(text, text, text, text) from public, anon, authenticated;
grant execute on function public.qr_link_info(text) to service_role;
grant execute on function public.qr_check_in(text, text, uuid) to service_role;
grant execute on function public.qr_add_visitor(text, text, text, text) to service_role;

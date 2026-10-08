-- Children's church, further (Stratum core): lesson materials for teachers,
-- uploaded by whoever runs children's church (manage_children), and an
-- approximate graduation month per child, with a function to move a child up
-- an age group. Idempotent.

-- Materials are resources of a new kind, with an optional lesson date.
alter table resources drop constraint if exists resources_kind_check;
alter table resources add constraint resources_kind_check check (kind in ('logo', 'brand', 'press', 'children'));
alter table resources add column if not exists lesson_date date;

drop policy if exists "resources_write" on resources;
create policy "resources_write" on resources for all
  using (zone_id = public.current_user_zone_id()
         and (public.current_user_can('manage_access') or (kind = 'children' and public.current_user_can('manage_children'))))
  with check (zone_id = public.current_user_zone_id()
         and (public.current_user_can('manage_access') or (kind = 'children' and public.current_user_can('manage_children'))));

-- Lesson plans come as slides, documents, spreadsheets, pictures, audio and video.
update storage.buckets set allowed_mime_types = array[
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
  'application/pdf', 'application/postscript', 'application/illustrator',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/mpeg', 'audio/mp4', 'video/mp4',
  'application/zip'
] where id = 'resources';

-- Roughly when a child moves up (a month; stored as its first day). Nobody's
-- age is stored (only their birthday), so this is set by the head, not worked out.
alter table members add column if not exists expected_graduation date;

-- The children at a location, for staff who can't read the members table.
drop function if exists public.children_roster(uuid, text[]);
create function public.children_roster(p_church_id uuid, p_age_groups text[])
returns table (id uuid, first_name text, last_name text, age_group text, guardian_name text, guardian_phone text, birthday text, expected_graduation date)
language sql security definer stable set search_path = public
as $$
  select m.id, m.first_name, m.last_name, m.age_group, m.guardian_name, m.guardian_phone, m.birthday, m.expected_graduation
  from public.members m
  where m.church_id = p_church_id
    and m.age_group = any(p_age_groups)
    and (public.current_user_can('check_in') or public.current_user_can('manage_children'))
    and p_church_id in (select public.current_user_scope_church_ids())
$$;
grant execute on function public.children_roster(uuid, text[]) to authenticated;

-- Set (or clear) a child's expected graduation month.
create or replace function public.set_child_graduation(p_member uuid, p_month date)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not public.current_user_can('manage_children') then return false; end if;
  update public.members set expected_graduation = case when p_month is null then null else date_trunc('month', p_month)::date end
  where id = p_member and church_id in (select public.current_user_scope_church_ids());
  return found;
end $$;
revoke all on function public.set_child_graduation(uuid, date) from public, anon;
grant execute on function public.set_child_graduation(uuid, date) to authenticated;

-- Move a child up to the next age group.
create or replace function public.graduate_child(p_member uuid, p_to text)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not public.current_user_can('manage_children') or p_to is null or btrim(p_to) = '' then return false; end if;
  update public.members set age_group = p_to, expected_graduation = null
  where id = p_member and age_group is distinct from p_to and church_id in (select public.current_user_scope_church_ids());
  return found;
end $$;
revoke all on function public.graduate_child(uuid, text) from public, anon;
grant execute on function public.graduate_child(uuid, text) to authenticated;

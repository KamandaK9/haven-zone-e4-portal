-- Sub-zones as a level of their own (Stratum core): a story, when it began,
-- and a record of who has held each leadership position, so a sub-zone page
-- can show its governors over time. Idempotent.

alter table sub_zones add column if not exists history text;
alter table sub_zones add column if not exists founded_year int;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sub_zones_history_len') then
    alter table sub_zones add constraint sub_zones_history_len check (history is null or char_length(history) <= 10000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sub_zones_founded_year') then
    alter table sub_zones add constraint sub_zones_founded_year check (founded_year is null or founded_year between 1900 and 2100);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Who held which position, where, and when. Recorded automatically when a
-- member's position or chapter changes; Directors add earlier holders by
-- hand (manual) and correct dates. started_on null = before records began.
-- The ordinary 'member' position isn't recorded.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists position_history (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  member_name text not null check (char_length(member_name) between 1 and 200),
  position text not null check (char_length(position) between 1 and 60),
  church_id uuid references churches(id) on delete set null,
  sub_zone_id uuid references sub_zones(id) on delete cascade,
  started_on date,
  ended_on date,
  manual boolean not null default false,
  created_at timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);
create index if not exists position_history_sub_zone_idx on position_history(sub_zone_id);
create index if not exists position_history_church_idx on position_history(church_id);
create index if not exists position_history_open_idx on position_history(member_id) where ended_on is null;

create or replace function public.record_position_history()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_sub uuid;
begin
  if tg_op = 'DELETE' then
    update position_history set ended_on = current_date where member_id = old.id and ended_on is null and not manual;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.position is not distinct from old.position and new.church_id is not distinct from old.church_id then
      -- Only the name changed: keep the open entries' names current.
      if new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name then
        update position_history set member_name = left(trim(new.first_name || ' ' || new.last_name), 200)
          where member_id = new.id and ended_on is null and not manual;
      end if;
      return new;
    end if;
    -- Started today and changed today: a correction, not history.
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

drop trigger if exists record_position_history on members;
create trigger record_position_history
  after insert or update of position, church_id, first_name, last_name on members
  for each row execute function public.record_position_history();
drop trigger if exists record_position_history_delete on members;
create trigger record_position_history_delete
  before delete on members
  for each row execute function public.record_position_history();

-- A chapter moved to another sub-zone takes its current leaders with it.
create or replace function public.follow_chapter_sub_zone()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.sub_zone_id is distinct from old.sub_zone_id then
    update position_history set sub_zone_id = new.sub_zone_id where church_id = new.id and ended_on is null and not manual;
  end if;
  return new;
end;
$$;
drop trigger if exists follow_chapter_sub_zone on churches;
create trigger follow_chapter_sub_zone
  after update of sub_zone_id on churches
  for each row execute function public.follow_chapter_sub_zone();

-- Everyone already in a leadership position: an open entry, start unknown.
insert into position_history (zone_id, member_id, member_name, position, church_id, sub_zone_id, started_on)
select m.zone_id, m.id, left(coalesce(nullif(trim(m.first_name || ' ' || m.last_name), ''), 'Unnamed'), 200), m.position, m.church_id, c.sub_zone_id, null
from members m
left join churches c on c.id = m.church_id
where m.position <> 'member'
  and not exists (select 1 from position_history h where h.member_id = m.id and h.ended_on is null);

alter table position_history enable row level security;

-- Leaders read it; the Directors (who change the structure) correct it.
drop policy if exists "position_history_select" on position_history;
create policy "position_history_select" on position_history for select
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "position_history_insert" on position_history;
create policy "position_history_insert" on position_history for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() = 'super_admin' and manual);
drop policy if exists "position_history_update" on position_history;
create policy "position_history_update" on position_history for update
  using (zone_id = public.current_user_zone_id() and public.current_user_role() = 'super_admin')
  with check (zone_id = public.current_user_zone_id() and public.current_user_role() = 'super_admin');
drop policy if exists "position_history_delete" on position_history;
create policy "position_history_delete" on position_history for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_role() = 'super_admin');

-- An entry stays with its person and place; only names and dates change.
create or replace function public.guard_position_history()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_trusted_writer() then
    return new;
  end if;
  if new.member_id is distinct from old.member_id or new.zone_id is distinct from old.zone_id
     or new.position is distinct from old.position or new.manual is distinct from old.manual then
    raise exception 'Only the name, place and dates of a history entry can change.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_position_history on position_history;
create trigger guard_position_history
  before update on position_history
  for each row execute function public.guard_position_history();

revoke execute on function public.record_position_history() from anon, public;
revoke execute on function public.follow_chapter_sub_zone() from anon, public;
revoke execute on function public.guard_position_history() from anon, public;

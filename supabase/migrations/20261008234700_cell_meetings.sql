-- Cell meetings (Stratum core): the weekly register a cell leader takes at
-- their cell meeting, apart from Sunday check-in. One meeting per cell per
-- day; who came is a set of members. Leaders write for the cells in their
-- scope (their cell and the cells inside it; a pastor, the cells in their
-- area). Idempotent.

create table if not exists cell_meetings (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  cell_id uuid not null references cells(id) on delete cascade,
  meeting_date date not null,
  note text check (note is null or char_length(note) <= 300),
  created_by uuid references profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  unique (cell_id, meeting_date)
);
create index if not exists cell_meetings_cell_date_idx on cell_meetings(cell_id, meeting_date desc);

create table if not exists cell_meeting_attendance (
  meeting_id uuid not null references cell_meetings(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  primary key (meeting_id, member_id)
);
create index if not exists cell_meeting_attendance_member_idx on cell_meeting_attendance(member_id);

-- The cell a meeting belongs to, for policies on its attendance rows.
create or replace function public.cell_meeting_cell(p_meeting uuid)
returns uuid
language sql security definer stable set search_path = public
as $$
  select cell_id from public.cell_meetings where id = p_meeting
$$;

alter table cell_meetings enable row level security;
alter table cell_meeting_attendance enable row level security;

drop policy if exists "cell_meetings_select" on cell_meetings;
create policy "cell_meetings_select" on cell_meetings for select
  using (
    zone_id = public.current_user_zone_id()
    and (public.current_user_can('view_attendance') or public.current_user_can('take_cell_attendance'))
    and cell_id in (select public.current_user_scope_cell_ids())
  );
drop policy if exists "cell_meetings_insert" on cell_meetings;
create policy "cell_meetings_insert" on cell_meetings for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('take_cell_attendance')
    and created_by = auth.uid()
    and cell_id in (select public.current_user_scope_cell_ids())
  );
drop policy if exists "cell_meetings_update" on cell_meetings;
create policy "cell_meetings_update" on cell_meetings for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('take_cell_attendance')
         and cell_id in (select public.current_user_scope_cell_ids()))
  with check (zone_id = public.current_user_zone_id());
drop policy if exists "cell_meetings_delete" on cell_meetings;
create policy "cell_meetings_delete" on cell_meetings for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_can('take_cell_attendance')
         and cell_id in (select public.current_user_scope_cell_ids()));

drop policy if exists "cell_meeting_attendance_select" on cell_meeting_attendance;
create policy "cell_meeting_attendance_select" on cell_meeting_attendance for select
  using (
    zone_id = public.current_user_zone_id()
    and (public.current_user_can('view_attendance') or public.current_user_can('take_cell_attendance'))
    and public.cell_meeting_cell(meeting_id) in (select public.current_user_scope_cell_ids())
  );
drop policy if exists "cell_meeting_attendance_write" on cell_meeting_attendance;
create policy "cell_meeting_attendance_write" on cell_meeting_attendance for all
  using (
    zone_id = public.current_user_zone_id() and public.current_user_can('take_cell_attendance')
    and public.cell_meeting_cell(meeting_id) in (select public.current_user_scope_cell_ids())
  )
  with check (
    zone_id = public.current_user_zone_id() and public.current_user_can('take_cell_attendance')
    and public.cell_meeting_cell(meeting_id) in (select public.current_user_scope_cell_ids())
    and member_id in (select public.current_user_scope_member_ids())
  );

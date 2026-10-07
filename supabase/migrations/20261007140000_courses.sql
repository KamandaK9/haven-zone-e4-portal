-- Courses (Stratum core): cohort-based courses such as Foundation School.
-- A course has numbered classes; a cohort is one run of it at one location
-- with a teacher; a member completes the course once they've attended
-- `required_classes` distinct classes — in any cohort, so a class missed
-- can be made up in a later one. Idempotent: safe to re-run.

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  name text not null,
  required_classes int not null default 7 check (required_classes > 0),
  created_at timestamptz not null default now(),
  unique (zone_id, name)
);

create table if not exists course_classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  number int not null,
  title text not null default '',
  unique (course_id, number)
);

create table if not exists cohorts (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  name text not null,
  start_date date,
  teacher_profile_id uuid references profiles(id) on delete set null,
  closed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists cohorts_church_idx on cohorts(church_id);
create index if not exists cohorts_teacher_idx on cohorts(teacher_profile_id);

create table if not exists cohort_students (
  cohort_id uuid not null references cohorts(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  primary key (cohort_id, member_id)
);
create index if not exists cohort_students_member_idx on cohort_students(member_id);

-- One row per member per class, wherever it was taken (cohort_id records
-- which run), so a make-up in a later cohort counts and a class can't count
-- twice.
create table if not exists class_attendance (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  class_id uuid not null references course_classes(id) on delete cascade,
  cohort_id uuid not null references cohorts(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  attended_on date not null default current_date,
  marked_by uuid references profiles(id) on delete set null,
  unique (class_id, member_id)
);
create index if not exists class_attendance_member_idx on class_attendance(member_id);
create index if not exists class_attendance_cohort_idx on class_attendance(cohort_id);

-- Cohorts the caller may see: every cohort in their scope if they manage
-- courses or can see members; their own if they teach it.
create or replace function public.current_user_cohort_ids()
returns setof uuid
language sql security definer stable set search_path = public
as $$
  select c.id
  from public.cohorts c
  where c.zone_id = public.current_user_zone_id()
    and (
      c.teacher_profile_id = auth.uid()
      or ((public.current_user_can('manage_courses') or public.current_user_can('view_members'))
          and c.church_id in (select public.current_user_scope_church_ids()))
    )
$$;

-- Whether the caller may mark attendance in a cohort: its teacher, or
-- someone who manages courses there.
create or replace function public.can_teach_cohort(p_cohort_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.cohorts c
    where c.id = p_cohort_id
      and c.zone_id = public.current_user_zone_id()
      and (
        (c.teacher_profile_id = auth.uid() and public.current_user_can('teach_courses'))
        or (public.current_user_can('manage_courses') and c.church_id in (select public.current_user_scope_church_ids()))
      )
  )
$$;

-- A cohort's students, for its teacher — who can't read the members table.
-- Names and cells only, never contact details.
create or replace function public.cohort_roster(p_cohort_id uuid)
returns table (member_id uuid, first_name text, last_name text, cell_name text)
language sql security definer stable set search_path = public
as $$
  select m.id, m.first_name, m.last_name, cl.name
  from public.cohort_students s
  join public.members m on m.id = s.member_id
  left join public.cells cl on cl.id = m.cell_id
  where s.cohort_id = p_cohort_id
    and p_cohort_id in (select public.current_user_cohort_ids())
$$;

alter table courses enable row level security;
alter table course_classes enable row level security;
alter table cohorts enable row level security;
alter table cohort_students enable row level security;
alter table class_attendance enable row level security;

drop policy if exists "courses_select" on courses;
create policy "courses_select" on courses for select using (zone_id = public.current_user_zone_id());
drop policy if exists "courses_write" on courses;
create policy "courses_write" on courses for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses'));

drop policy if exists "course_classes_select" on course_classes;
create policy "course_classes_select" on course_classes for select using (zone_id = public.current_user_zone_id());
drop policy if exists "course_classes_write" on course_classes;
create policy "course_classes_write" on course_classes for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses'));

drop policy if exists "cohorts_select" on cohorts;
-- Checked on the row itself rather than via current_user_cohort_ids(): that
-- function can't see a row being inserted, so INSERT … RETURNING would fail.
create policy "cohorts_select" on cohorts for select
  using (
    zone_id = public.current_user_zone_id()
    and (
      teacher_profile_id = auth.uid()
      or ((public.current_user_can('manage_courses') or public.current_user_can('view_members'))
          and church_id in (select public.current_user_scope_church_ids()))
    )
  );
drop policy if exists "cohorts_insert" on cohorts;
create policy "cohorts_insert" on cohorts for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses')
              and church_id in (select public.current_user_scope_church_ids()));
drop policy if exists "cohorts_update" on cohorts;
create policy "cohorts_update" on cohorts for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses')
         and church_id in (select public.current_user_scope_church_ids()));
drop policy if exists "cohorts_delete" on cohorts;
create policy "cohorts_delete" on cohorts for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses')
         and church_id in (select public.current_user_scope_church_ids()));

drop policy if exists "cohort_students_select" on cohort_students;
create policy "cohort_students_select" on cohort_students for select
  using (cohort_id in (select public.current_user_cohort_ids()) or member_id = public.current_member_id());
drop policy if exists "cohort_students_write" on cohort_students;
create policy "cohort_students_write" on cohort_students for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses')
         and cohort_id in (select public.current_user_cohort_ids()))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses')
              and cohort_id in (select public.current_user_cohort_ids()));

-- Members in scope (for their progress on member pages), the cohort's own
-- teacher, and the member themselves.
drop policy if exists "class_attendance_select" on class_attendance;
create policy "class_attendance_select" on class_attendance for select
  using (
    zone_id = public.current_user_zone_id()
    and (
      cohort_id in (select public.current_user_cohort_ids())
      or member_id = public.current_member_id()
      or (public.current_user_can('view_members') and member_id in (select public.current_user_scope_member_ids()))
    )
  );
drop policy if exists "class_attendance_insert" on class_attendance;
create policy "class_attendance_insert" on class_attendance for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.can_teach_cohort(cohort_id)
    and exists (select 1 from public.cohort_students s where s.cohort_id = class_attendance.cohort_id and s.member_id = class_attendance.member_id)
  );
drop policy if exists "class_attendance_delete" on class_attendance;
create policy "class_attendance_delete" on class_attendance for delete
  using (zone_id = public.current_user_zone_id() and public.can_teach_cohort(cohort_id));

grant execute on function public.cohort_roster(uuid) to authenticated;

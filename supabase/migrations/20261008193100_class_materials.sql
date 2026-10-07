-- Class materials (Stratum core): what each class of a course is taught
-- from — the manual, notes or slides as a file, or a link (a video, a
-- document online). Added once by whoever manages courses; every teacher
-- of the course opens them. Files sit in a private bucket and are only
-- handed out as short-lived signed links. Idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'class-materials', 'class-materials', false, 52428800,
  array[
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png', 'image/jpeg', 'audio/mpeg', 'video/mp4'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists class_materials (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  class_id uuid not null references course_classes(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  -- Either an uploaded file (in the zone's folder) or a link.
  file_path text,
  file_name text,
  mime text,
  bytes bigint,
  url text check (url is null or url ~* '^https?://'),
  sort_order int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint class_materials_file_or_link check ((file_path is null) <> (url is null)),
  constraint class_materials_file_folder check (file_path is null or (file_path like zone_id::text || '/%' and file_path not like '%..%'))
);
create index if not exists class_materials_class_idx on class_materials(class_id, sort_order);

alter table class_materials enable row level security;

drop policy if exists "class_materials_select" on class_materials;
create policy "class_materials_select" on class_materials for select
  using (zone_id = public.current_user_zone_id()
         and (public.current_user_can('manage_courses') or public.current_user_can('teach_courses')));
drop policy if exists "class_materials_write" on class_materials;
create policy "class_materials_write" on class_materials for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_courses'));

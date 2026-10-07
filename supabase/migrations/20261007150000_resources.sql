-- Resources (Stratum core): the organisation's media set — logos, brand
-- assets, press releases — for leaders to download, plus logo-usage
-- guidelines. Files live in a private bucket and are only ever handed out
-- as short-lived signed URLs. Idempotent: safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resources', 'resources', false, 52428800,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/postscript', 'application/illustrator',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  kind text not null check (kind in ('logo', 'brand', 'press')),
  title text not null,
  description text,
  file_path text not null,
  file_name text not null,
  mime text not null,
  bytes bigint not null default 0,
  width int, -- pixels, for raster images
  height int,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists resources_zone_kind_idx on resources(zone_id, kind);

create table if not exists resource_settings (
  zone_id uuid primary key references zones(id) on delete cascade,
  logo_guidelines text,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table resources enable row level security;
alter table resource_settings enable row level security;

-- Every leader login reads; the zone's admins (manage_access) add and remove.
drop policy if exists "resources_select" on resources;
create policy "resources_select" on resources for select
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "resources_write" on resources;
create policy "resources_write" on resources for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'));

drop policy if exists "resource_settings_select" on resource_settings;
create policy "resource_settings_select" on resource_settings for select
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "resource_settings_write" on resource_settings;
create policy "resource_settings_write" on resource_settings for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'));

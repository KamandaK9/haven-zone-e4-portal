-- The self check-in screen's look (Stratum core): a welcome title, tagline
-- and background image the organisation chooses (Settings → Self check-in
-- screen). The image is a welcome picture, not personal information, so it
-- lives in a public bucket — a kiosk left running all service can't depend
-- on short-lived signed links. Idempotent: safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('check-in-screen', 'check-in-screen', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists check_in_screen (
  zone_id uuid primary key references zones(id) on delete cascade,
  title text check (title is null or char_length(title) <= 80),
  tagline text check (tagline is null or char_length(tagline) <= 120),
  background_path text,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  -- An uploaded background must sit in the zone's own folder.
  constraint check_in_screen_background_folder
    check (background_path is null or (background_path like zone_id::text || '/%' and background_path not like '%..%'))
);

alter table check_in_screen enable row level security;

-- Every leader login reads it (a check-in volunteer runs the kiosk); the
-- zone's admins change it.
drop policy if exists "check_in_screen_select" on check_in_screen;
create policy "check_in_screen_select" on check_in_screen for select
  using (zone_id = public.current_user_zone_id() and public.current_user_role() in ('super_admin', 'admin'));
drop policy if exists "check_in_screen_write" on check_in_screen;
create policy "check_in_screen_write" on check_in_screen for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'));

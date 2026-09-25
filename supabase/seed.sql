-- Sample content so the annual-event pages have something to show.
-- Loaded by `supabase db reset` (see config.toml [db.seed]), or paste into
-- the Supabase SQL editor. Adds two "The Haven Zonal Convention"
-- editions (the newest is featured, the older one appears under "Past
-- editions") with a cover, pictures, a resource file and two videos.
-- The pictures/file are placeholders served from /public/demo.
--
-- Safe to re-run. To remove it all, run the DELETE at the bottom.

do $$
declare
  z uuid;
  s uuid;
begin
  select id into z from zones order by created_at limit 1;
  if z is null then
    -- `supabase db reset` runs this straight after migrations, before any
    -- zone exists; skip quietly rather than failing the reset.
    raise notice 'No zone found - finish zone setup first, then re-run this.';
    return;
  end if;

  insert into event_series (zone_id, slug, name, sort_order)
  values (z, 'zonal-convention', 'The Haven Zonal Convention', 2)
  on conflict (zone_id, slug) do nothing;
  select id into s from event_series where zone_id = z and slug = 'zonal-convention';

  update event_series
  set description = 'Sample text - edit or replace it with "Edit overview". The Zonal Convention brings the zone together each year for teaching, worship and fellowship.'
  where id = s and description is null;

  -- clear any earlier run of this script
  delete from events where id in (
    '5a1d0000-0000-4000-8000-000000000001',
    '5a1d0000-0000-4000-8000-000000000002'
  );

  insert into events (id, zone_id, title, date, end_date, time, type, location, description, cover_url, series_id)
  values
  (
    '5a1d0000-0000-4000-8000-000000000001', z,
    'The Haven Zonal Convention 2026', '2026-08-13', '2026-08-16', 'All day', 'flagship',
    'Sample City, Southern Africa',
    E'Sample content - replace it with what this convention was really about.\n\nFour days of teaching, worship and fellowship bringing chapters from across the zone together. Leaders and members from every country gathered for the main sessions, breakout meetings for governors and their teams, and a closing service on the final evening.\n\nUse "Edit page" to change this text, swap the cover, and add your own pictures, resources and videos.',
    '/demo/cover-2026.svg', s
  ),
  (
    '5a1d0000-0000-4000-8000-000000000002', z,
    'The Haven Zonal Convention 2025', '2025-08-14', '2025-08-17', 'All day', 'flagship',
    'Sample City, Southern Africa',
    'Sample content - last year''s edition. It shows up under "Past editions" and opens its own page when tapped.',
    '/demo/cover-2025.svg', s
  );

  insert into event_media (event_id, zone_id, kind, url, title, sort_order) values
    ('5a1d0000-0000-4000-8000-000000000001', z, 'image', '/demo/gallery-1.svg', 'Worship', 0),
    ('5a1d0000-0000-4000-8000-000000000001', z, 'image', '/demo/gallery-2.svg', 'Teaching session', 1),
    ('5a1d0000-0000-4000-8000-000000000001', z, 'image', '/demo/gallery-3.svg', 'Fellowship', 2),
    ('5a1d0000-0000-4000-8000-000000000001', z, 'image', '/demo/gallery-4.svg', 'Leaders gathering', 3),
    ('5a1d0000-0000-4000-8000-000000000001', z, 'file',  '/demo/sample-programme.pdf', 'Convention programme (sample).pdf', 4),
    ('5a1d0000-0000-4000-8000-000000000001', z, 'video', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'Sample video 1', 5),
    ('5a1d0000-0000-4000-8000-000000000001', z, 'video', 'https://www.youtube.com/watch?v=YE7VzlLtp-4', 'Sample video 2', 6),
    ('5a1d0000-0000-4000-8000-000000000002', z, 'image', '/demo/gallery-2.svg', 'Teaching session', 0),
    ('5a1d0000-0000-4000-8000-000000000002', z, 'image', '/demo/gallery-4.svg', 'Leaders gathering', 1);
end $$;

-- To remove the sample content:
-- delete from events where id in (
--   '5a1d0000-0000-4000-8000-000000000001',
--   '5a1d0000-0000-4000-8000-000000000002'
-- );

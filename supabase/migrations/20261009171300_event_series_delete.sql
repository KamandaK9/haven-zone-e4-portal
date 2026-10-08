-- Organisations can add their own annual events (Stratum core), so they can
-- also remove one they added. Same capability as editing them. Idempotent.
drop policy if exists "event_series_delete" on event_series;
create policy "event_series_delete" on event_series for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_events'));

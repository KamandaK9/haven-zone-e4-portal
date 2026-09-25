-- Handbook category thresholds, per zone. Null means "use the defaults the
-- tenant ships with its handbook" (src/tenant/handbook/rules.ts); otherwise
-- a sparse override keyed by rung code — see src/lib/handbook/rules.ts.
alter table zones add column if not exists handbook_rules jsonb;

-- zones had a select policy only, so updates from a signed-in session
-- matched no rows and silently did nothing (this is what the display
-- currency setting has been hitting). Zone settings are for whoever may
-- manage access — the same capability that gates the Settings page.
drop policy if exists "zones_update" on zones;
create policy "zones_update" on zones for update
  using (id = public.current_user_zone_id() and public.current_user_can('manage_access'))
  with check (id = public.current_user_zone_id());

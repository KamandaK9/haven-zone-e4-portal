-- The organisation's colours (Stratum core): the nav bar's colour and the
-- brand colour, as chosen in Settings → Colours. Null means "use the look the
-- deployment ships with" (src/tenant/theme.css). Written through zones_update.
-- Idempotent.
alter table zones add column if not exists theme jsonb;

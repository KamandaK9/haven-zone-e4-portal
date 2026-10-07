-- Privacy & legal details editable in Settings (Stratum core). Null means
-- "use the tenant's defaults" (src/tenant → legal); otherwise the zone's own
-- registered name, address, Information Officer, operators, retention and
-- privacy-notice version, merged over those defaults — see
-- src/lib/legal-settings.ts. Written through the existing zones_update
-- policy (manage_access only). Idempotent.
alter table zones add column if not exists legal_settings jsonb;

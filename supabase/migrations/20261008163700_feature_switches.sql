-- Features a church has switched off (Stratum core). Which features a
-- deployment's plan includes is set in its tenant config (tenant.modules);
-- within that, the organisation can turn included ones off and on again in
-- Settings → Features. A feature is on when it's included and not listed
-- here. Written through zones_update (manage_access). Idempotent.
alter table zones add column if not exists disabled_modules text[] not null default '{}';

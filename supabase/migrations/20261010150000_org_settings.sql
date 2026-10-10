-- The organisation's own settings, edited in Settings → Organisation, over
-- the defaults in the tenant file (login wording, bank accounts, meeting
-- types, department suggestions, attendance rules). One validated object,
-- like legal_settings; null = all defaults. See src/lib/org-settings.ts.
alter table zones add column if not exists settings jsonb;

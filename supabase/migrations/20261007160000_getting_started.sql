-- The dashboard's "Getting started" checklist: steps the app can't detect
-- itself that an admin ticked off, and whether they dismissed it.
-- { "dismissed": true, "done": ["step-key", …] }. Idempotent.
alter table zones add column if not exists getting_started jsonb not null default '{}'::jsonb;

-- Which capabilities this organisation's logins have already been given by
-- default. When the code adds a new one, the next sign-in gives it to every
-- login whose position holds it by default (unless it was revoked for that
-- person) and records it here — see src/lib/capability-sync.ts. Null: not
-- synced yet; the first sync records the current list without granting
-- anything (earlier capabilities were given by their own migrations).
-- Replaces hand-written backfills that named a tenant's positions.
alter table zones add column if not exists known_capabilities text[];

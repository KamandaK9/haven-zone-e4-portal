-- Enriches audit_log with which record an action touched and its
-- before/after state, so a merge, an access change or an export can be
-- reconstructed rather than just described in the summary text. All
-- nullable — existing callers of logAudit() keep writing rows with these
-- left null.

alter table audit_log add column if not exists entity_type text;
alter table audit_log add column if not exists entity_id uuid;
alter table audit_log add column if not exists before jsonb;
alter table audit_log add column if not exists after jsonb;

create index if not exists audit_log_entity_idx on audit_log(zone_id, entity_type, entity_id) where entity_type is not null;

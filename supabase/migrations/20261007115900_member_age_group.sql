-- Age group (Stratum core): which of the tenant's age groups a member is in
-- (tenant.ageGroups keys, e.g. "children"/"teens"/"youth"/"adults"). Stored
-- rather than derived from birthday — imported birthdays often carry no year.
-- Idempotent: safe to re-run.
alter table members add column if not exists age_group text;
create index if not exists members_age_group_idx on members(age_group) where age_group is not null;

-- Member statuses depend on the Stratum edition (Cornerstone: Member /
-- Worker / Cell Leader / Pastor; Forge: Staff / Contractor / …), so the
-- database no longer fixes the list; the app validates against the edition
-- (src/lib/editions.ts). Existing values are unchanged.
alter table members drop constraint if exists members_role_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'members_role_len') then
    alter table members add constraint members_role_len check (char_length(role) between 1 and 40);
  end if;
end $$;

-- Custom member fields and import templates (Stratum core). An organisation
-- defines its own extra member details (e.g. "Baptism date", "Department")
-- and how its spreadsheet's columns map onto members, instead of us adding
-- code per client. Idempotent.

-- ─────────────────────────────────────────────────────────────────────────
-- Field definitions. Visibility is per field:
--   leaders  — any leader who can see the member
--   contact  — leaders who may see contact details
--   admins   — sensitive: only whoever manages settings
-- member_access: whether members see (or edit) their own value.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists member_fields (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,49}$'),
  label text not null check (char_length(label) between 1 and 80),
  type text not null check (type in ('text', 'number', 'date', 'select', 'yes_no')),
  options text[] not null default '{}',
  visibility text not null default 'leaders' check (visibility in ('leaders', 'contact', 'admins')),
  member_access text not null default 'hidden' check (member_access in ('hidden', 'view', 'edit')),
  sort_order int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (zone_id, key)
);

alter table member_fields enable row level security;

-- Everyone signed in reads the definitions (members need them for their
-- own profile); the values themselves are protected below.
drop policy if exists "member_fields_select" on member_fields;
create policy "member_fields_select" on member_fields for select
  using (zone_id = public.current_user_zone_id());
drop policy if exists "member_fields_write" on member_fields;
create policy "member_fields_write" on member_fields for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_settings'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_settings'));

-- ─────────────────────────────────────────────────────────────────────────
-- Values, one row per member and field, so each field's visibility is
-- enforced by the database — a leader who can read a member still can't
-- read an "admins" field through the API.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists member_field_values (
  member_id uuid not null references members(id) on delete cascade,
  field_id uuid not null references member_fields(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  value text not null check (char_length(value) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key (member_id, field_id)
);
create index if not exists member_field_values_field_idx on member_field_values(field_id);

-- Whether the caller may see (p_write = false) or change (true) this
-- member's value for this field.
create or replace function public.can_access_member_field(p_member_id uuid, p_field_id uuid, p_write boolean)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.member_fields f
    join public.members m on m.id = p_member_id and m.zone_id = f.zone_id
    where f.id = p_field_id
      and f.zone_id = public.current_user_zone_id()
      and (
        -- Their own record, if the field is shown to members.
        (m.id = public.current_member_id() and (f.member_access = 'edit' or (not p_write and f.member_access = 'view')))
        -- Leaders, within their scope, by the field's visibility.
        or (
          m.church_id in (select public.current_user_scope_church_ids())
          and case f.visibility
            when 'admins' then public.current_user_can('manage_settings')
            when 'contact' then public.current_user_can('view_contact_details') and (not p_write or public.current_user_can('manage_members'))
            else public.current_user_can('view_members') and (not p_write or public.current_user_can('manage_members'))
          end
        )
      )
  )
$$;

alter table member_field_values enable row level security;

drop policy if exists "member_field_values_select" on member_field_values;
create policy "member_field_values_select" on member_field_values for select
  using (public.can_access_member_field(member_id, field_id, false));
drop policy if exists "member_field_values_insert" on member_field_values;
create policy "member_field_values_insert" on member_field_values for insert
  with check (zone_id = public.current_user_zone_id() and public.can_access_member_field(member_id, field_id, true));
drop policy if exists "member_field_values_update" on member_field_values;
create policy "member_field_values_update" on member_field_values for update
  using (public.can_access_member_field(member_id, field_id, true))
  with check (zone_id = public.current_user_zone_id() and public.can_access_member_field(member_id, field_id, true));
drop policy if exists "member_field_values_delete" on member_field_values;
create policy "member_field_values_delete" on member_field_values for delete
  using (public.can_access_member_field(member_id, field_id, true));

-- A value can't be moved to another member or field.
create or replace function public.guard_member_field_value()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_trusted_writer() then
    return new;
  end if;
  if new.member_id is distinct from old.member_id or new.field_id is distinct from old.field_id or new.zone_id is distinct from old.zone_id then
    raise exception 'A value can''t be moved to another member or field.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_member_field_value on member_field_values;
create trigger guard_member_field_value
  before update on member_field_values
  for each row execute function public.guard_member_field_value();

-- ─────────────────────────────────────────────────────────────────────────
-- Import templates: how this organisation's spreadsheet columns map onto
-- members — { "<normalised column name>": "builtin:<field>" |
-- "custom:<field key>" | "skip" }. One per kind of import.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists import_templates (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  kind text not null check (kind in ('members')),
  mapping jsonb not null default '{}',
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (zone_id, kind)
);

alter table import_templates enable row level security;

drop policy if exists "import_templates_select" on import_templates;
create policy "import_templates_select" on import_templates for select
  using (
    zone_id = public.current_user_zone_id()
    and (public.current_user_can('manage_members') or public.current_user_can('manage_settings'))
  );
drop policy if exists "import_templates_write" on import_templates;
create policy "import_templates_write" on import_templates for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_settings'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_settings'));

revoke execute on function public.can_access_member_field(uuid, uuid, boolean) from anon, public;
grant execute on function public.can_access_member_field(uuid, uuid, boolean) to authenticated, service_role;
revoke execute on function public.guard_member_field_value() from anon, public;

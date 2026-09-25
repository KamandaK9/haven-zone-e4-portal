-- Chapter records (Stratum core): the cells directory, and a register of
-- minutes, correspondence, bank allocation advices and cheques — each with
-- its paperwork attached. Idempotent: safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────
-- Cells: groups below a chapter, two levels deep. parent_id null = the upper
-- level (a senior cell); otherwise a cell within that senior cell. What the
-- levels are called is tenant config.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists cells (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  parent_id uuid references cells(id) on delete cascade,
  name text not null,
  leader_member_id uuid references members(id) on delete set null,
  meeting_day text,
  meeting_place text,
  created_at timestamptz not null default now()
);
create index if not exists cells_church_id_idx on cells(church_id);

alter table members add column if not exists cell_id uuid references cells(id) on delete set null;
create index if not exists members_cell_id_idx on members(cell_id) where cell_id is not null;

alter table cells enable row level security;

drop policy if exists "cells_select" on cells;
create policy "cells_select" on cells for select
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('view_members')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "cells_insert" on cells;
create policy "cells_insert" on cells for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_members')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "cells_update" on cells;
create policy "cells_update" on cells for update
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_members')
    and church_id in (select public.current_user_scope_church_ids())
  )
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_members')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "cells_delete" on cells;
create policy "cells_delete" on cells for delete
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_members')
    and church_id in (select public.current_user_scope_church_ids())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Records register. One table, three kinds; kind-specific columns are null
-- where they don't apply. Bank advices are finance records (manage_ledger);
-- minutes and correspondence are secretarial (manage_records).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists chapter_records (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  kind text not null check (kind in ('minutes', 'correspondence', 'bank_advice')),
  title text not null,
  record_date date not null,
  body text,
  -- minutes
  meeting_type text,
  event_id uuid references events(id) on delete set null,
  -- correspondence
  direction text check (direction in ('in', 'out')),
  counterparty text,
  -- correspondence + bank advices
  reference text,
  -- bank advices
  account text,
  amount numeric(12, 2),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists chapter_records_church_kind_idx on chapter_records(church_id, kind, record_date desc);

create or replace function public.record_capability(kind text)
returns text
language sql immutable
as $$
  select case when kind = 'bank_advice' then 'manage_ledger' else 'manage_records' end
$$;

alter table chapter_records enable row level security;

drop policy if exists "chapter_records_select" on chapter_records;
create policy "chapter_records_select" on chapter_records for select
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can(public.record_capability(kind))
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "chapter_records_insert" on chapter_records;
create policy "chapter_records_insert" on chapter_records for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can(public.record_capability(kind))
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "chapter_records_update" on chapter_records;
create policy "chapter_records_update" on chapter_records for update
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can(public.record_capability(kind))
    and church_id in (select public.current_user_scope_church_ids())
  )
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can(public.record_capability(kind))
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "chapter_records_delete" on chapter_records;
create policy "chapter_records_delete" on chapter_records for delete
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can(public.record_capability(kind))
    and church_id in (select public.current_user_scope_church_ids())
  );

-- Files attached to a record. Access follows the record: the subquery runs
-- under the caller's own RLS, so it only finds records they may see.
create table if not exists chapter_record_files (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references chapter_records(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists chapter_record_files_record_id_idx on chapter_record_files(record_id);

alter table chapter_record_files enable row level security;

drop policy if exists "chapter_record_files_select" on chapter_record_files;
create policy "chapter_record_files_select" on chapter_record_files for select
  using (exists (select 1 from chapter_records r where r.id = record_id));
drop policy if exists "chapter_record_files_insert" on chapter_record_files;
create policy "chapter_record_files_insert" on chapter_record_files for insert
  with check (
    zone_id = public.current_user_zone_id()
    and exists (select 1 from chapter_records r where r.id = record_id)
  );
drop policy if exists "chapter_record_files_delete" on chapter_record_files;
create policy "chapter_record_files_delete" on chapter_record_files for delete
  using (exists (select 1 from chapter_records r where r.id = record_id));

-- ─────────────────────────────────────────────────────────────────────────
-- Cheque register (the cheque book stubs). A cheque can be linked to the
-- ledger payment it was written for. Numbers are unique per chapter account.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists cheques (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  church_id uuid not null references churches(id) on delete cascade,
  account text not null,
  cheque_number text not null,
  issue_date date not null,
  payee text not null,
  amount numeric(12, 2) not null,
  purpose text,
  status text not null default 'issued' check (status in ('issued', 'cleared', 'cancelled', 'void')),
  ledger_entry_id uuid references ledger_entries(id) on delete set null,
  stub_path text,
  stub_file_name text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (church_id, account, cheque_number)
);

alter table cheques enable row level security;

drop policy if exists "cheques_select" on cheques;
create policy "cheques_select" on cheques for select
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "cheques_insert" on cheques;
create policy "cheques_insert" on cheques for insert
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "cheques_update" on cheques;
create policy "cheques_update" on cheques for update
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  )
  with check (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );
drop policy if exists "cheques_delete" on cheques;
create policy "cheques_delete" on cheques for delete
  using (
    zone_id = public.current_user_zone_id()
    and public.current_user_can('manage_ledger')
    and church_id in (select public.current_user_scope_church_ids())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Private bucket for record paperwork. Unlike event-media it is NOT public:
-- files are only ever read through short-lived signed URLs the server
-- issues after reading the row under the caller's RLS. Uploads use signed
-- upload URLs issued after the same check.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chapter-records', 'chapter-records', false, 26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─────────────────────────────────────────────────────────────────────────
-- New capability for existing logins: give manage_records to the positions
-- that hold it by default (see defaultCapabilities in src/lib/access.ts),
-- unless it was deliberately revoked for that person.
-- ─────────────────────────────────────────────────────────────────────────
update profiles set caps = array_append(caps, 'manage_records')
where not ('manage_records' = any(caps))
  and not ('manage_records' = any(revoked_caps))
  and (
    position in ('zonal_director', 'assistant_zonal_director', 'zonal_secretary', 'sub_zone_governor', 'governor')
    or (position in ('deputy_zonal_secretary', 'deputy_governor') and portfolio in ('administration', 'operations'))
  );

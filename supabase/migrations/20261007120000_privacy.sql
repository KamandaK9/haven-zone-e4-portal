-- Privacy (POPIA) — Stratum core: who accepted which version of the privacy
-- notice, and data-subject requests (access, correction, deletion,
-- objection) with the 30-day response clock. Idempotent.

-- Recorded per login when they accept the notice. The tenant's current
-- version lives in src/tenant (legal.privacyNoticeVersion); a login whose
-- accepted version differs is asked again. Written by the server only
-- (profiles has no write policies).
alter table profiles add column if not exists privacy_accepted_version text;
alter table profiles add column if not exists privacy_accepted_at timestamptz;

create table if not exists data_requests (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  member_id uuid references members(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  kind text not null check (kind in ('access', 'correction', 'deletion', 'objection', 'other')),
  details text not null check (char_length(details) between 1 and 4000),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'declined')),
  -- What was done, or why it was declined (e.g. financial records kept by
  -- law). Shown to the requester.
  response text check (response is null or char_length(response) <= 4000),
  created_at timestamptz not null default now(),
  -- POPIA/PAIA: respond within 30 days.
  due_at timestamptz not null default (now() + interval '30 days'),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);
create index if not exists data_requests_zone_idx on data_requests(zone_id, status, created_at desc);

alter table data_requests enable row level security;

-- Anyone signed in may make a request, as themselves, and see their own.
-- Whoever manages access (the Information Officer's team) sees and answers
-- them all.
drop policy if exists "data_requests_select" on data_requests;
create policy "data_requests_select" on data_requests for select
  using (
    zone_id = public.current_user_zone_id()
    and (profile_id = auth.uid() or public.current_user_can('manage_access'))
  );
drop policy if exists "data_requests_insert" on data_requests;
create policy "data_requests_insert" on data_requests for insert
  with check (
    zone_id = public.current_user_zone_id()
    and profile_id = auth.uid()
    and status = 'open'
    and response is null
  );
drop policy if exists "data_requests_update" on data_requests;
create policy "data_requests_update" on data_requests for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'));

-- The deadline and the requester's own words can't be edited afterwards.
create or replace function public.guard_data_request_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_trusted_writer() then
    return new;
  end if;
  if new.due_at is distinct from old.due_at
     or new.created_at is distinct from old.created_at
     or new.details is distinct from old.details
     or new.kind is distinct from old.kind
     or new.profile_id is distinct from old.profile_id
     or new.requester_email is distinct from old.requester_email then
    raise exception 'A request''s details and deadline can''t be changed.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_data_request_update on data_requests;
create trigger guard_data_request_update
  before update on data_requests
  for each row execute function public.guard_data_request_update();

revoke execute on function public.guard_data_request_update() from anon, public;

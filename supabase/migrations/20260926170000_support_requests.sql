-- Support requests (Stratum core): the Help button every signed-in person
-- has. Requests are kept here — so nothing is lost before email is set up —
-- and emailed to SUPPORT_EMAIL when it is. Idempotent: safe to re-run.

create table if not exists support_requests (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  category text not null check (category in ('question', 'problem', 'account', 'records', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  -- The page they were on when they asked.
  page_path text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  email_status text not null default 'not_sent' check (email_status in ('not_sent', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(id) on delete set null
);
create index if not exists support_requests_zone_idx on support_requests(zone_id, status, created_at desc);

alter table support_requests enable row level security;

-- Anyone signed in may ask, as themselves; they can see their own requests.
-- Whoever manages access sees and resolves them all.
drop policy if exists "support_requests_select" on support_requests;
create policy "support_requests_select" on support_requests for select
  using (
    zone_id = public.current_user_zone_id()
    and (profile_id = auth.uid() or public.current_user_can('manage_access'))
  );
drop policy if exists "support_requests_insert" on support_requests;
create policy "support_requests_insert" on support_requests for insert
  with check (zone_id = public.current_user_zone_id() and profile_id = auth.uid() and status = 'open');
drop policy if exists "support_requests_update" on support_requests;
create policy "support_requests_update" on support_requests for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_access'));

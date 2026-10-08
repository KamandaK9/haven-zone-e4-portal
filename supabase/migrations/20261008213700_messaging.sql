-- Messaging (Stratum core): SMS and email to members — campaigns a leader
-- writes and a pastor approves, plus the automatic ones (welcome for
-- first-timers, "we missed you", approved birthday batches). Every recipient
-- is recorded with what was sent and how it went, so usage can be metered
-- against a monthly cap. Written only by the server (service role); leaders
-- read what they're allowed to see. Idempotent.

-- People under 18 are contacted through a guardian; anyone can opt out.
alter table members add column if not exists guardian_name text;
alter table members add column if not exists guardian_phone text;
alter table members add column if not exists messaging_opt_out boolean not null default false;

create table if not exists messaging_settings (
  zone_id uuid primary key references zones(id) on delete cascade,
  -- Texts (segments) allowed per month; sending stops at the cap.
  monthly_sms_cap int not null default 1500 check (monthly_sms_cap >= 0),
  -- What one text segment costs, to estimate spend (the provider's price).
  sms_cost_estimate numeric not null default 0.06 check (sms_cost_estimate >= 0),
  sms_footer text not null default 'Reply STOP to opt out.',
  -- Automations: all off until someone turns them on.
  birthday_enabled boolean not null default false,
  welcome_enabled boolean not null default false,
  missed_enabled boolean not null default false,
  digest_enabled boolean not null default false,
  birthday_template text,
  birthday_guardian_template text,
  welcome_template text,
  missed_template text,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  kind text not null default 'manual' check (kind in ('manual', 'birthday', 'welcome', 'missed')),
  channel text not null check (channel in ('sms', 'email')),
  subject text,
  body text not null check (char_length(body) between 1 and 1600),
  -- What was asked for (for the record); who actually got it is message_recipients.
  audience jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'sending', 'sent', 'rejected', 'cancelled')),
  created_by uuid references profiles(id) on delete set null,
  created_by_name text,
  approved_by uuid references profiles(id) on delete set null,
  approved_by_name text,
  note text,
  batch_date date,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz
);
create index if not exists messages_zone_status_idx on messages(zone_id, status, created_at desc);
-- One birthday batch per day.
create unique index if not exists messages_birthday_day_idx on messages(zone_id, batch_date) where kind = 'birthday';

create table if not exists message_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  channel text not null check (channel in ('sms', 'email')),
  name text not null,
  to_address text not null,
  -- The member themselves, or their guardian.
  via text not null default 'self' check (via in ('self', 'guardian')),
  body text not null,
  segments int not null default 1,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  error text,
  provider_id text,
  sent_at timestamptz
);
create index if not exists message_recipients_message_idx on message_recipients(message_id);
create index if not exists message_recipients_member_idx on message_recipients(member_id, sent_at desc);
create index if not exists message_recipients_usage_idx on message_recipients(zone_id, sent_at) where status = 'sent';

alter table messaging_settings enable row level security;
alter table messages enable row level security;
alter table message_recipients enable row level security;

-- Approvers see every message; a sender sees their own.
create or replace function public.can_see_message(p_message_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.messages m
    where m.id = p_message_id
      and m.zone_id = public.current_user_zone_id()
      and (public.current_user_can('approve_messages')
           or (public.current_user_can('send_messages') and m.created_by = auth.uid()))
  )
$$;

drop policy if exists "messaging_settings_select" on messaging_settings;
create policy "messaging_settings_select" on messaging_settings for select
  using (zone_id = public.current_user_zone_id()
         and (public.current_user_can('send_messages') or public.current_user_can('approve_messages') or public.current_user_can('manage_settings')));

drop policy if exists "messages_select" on messages;
create policy "messages_select" on messages for select using (public.can_see_message(id));

drop policy if exists "message_recipients_select" on message_recipients;
create policy "message_recipients_select" on message_recipients for select using (public.can_see_message(message_id));

-- Livestreams (Stratum core): scheduled broadcasts with a lobby that shows
-- who has joined, live chat, and a replay afterwards. Video goes through
-- the deployment's video provider (Mux); presence and chat through
-- Supabase Realtime. Idempotent: safe to re-run.

create table if not exists live_streams (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references zones(id) on delete cascade,
  title text not null,
  description text,
  scheduled_at timestamptz not null,
  -- Who may watch: the whole zone, members/leaders of certain chapters, or
  -- leaders only.
  audience text not null default 'zone' check (audience in ('zone', 'chapters', 'leaders')),
  church_ids uuid[] not null default '{}',
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  chat_enabled boolean not null default true,
  provider text not null default 'mux' check (provider in ('mux')),
  provider_stream_id text,
  playback_id text,
  recording_asset_id text,
  recording_playback_id text,
  recording_status text not null default 'none' check (recording_status in ('none', 'processing', 'ready', 'errored')),
  recording_duration_seconds numeric,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists live_streams_zone_scheduled_idx on live_streams(zone_id, scheduled_at desc);
create unique index if not exists live_streams_provider_stream_id_key on live_streams(provider_stream_id) where provider_stream_id is not null;

-- The secret the broadcaster's app streams with. Separate table so only
-- stream managers can ever read it.
create table if not exists live_stream_keys (
  stream_id uuid primary key references live_streams(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  stream_key text not null
);

create table if not exists live_stream_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references live_streams(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  author_name text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references profiles(id) on delete set null
);
create index if not exists live_stream_messages_stream_idx on live_stream_messages(stream_id, created_at);

create table if not exists live_stream_mutes (
  stream_id uuid not null references live_streams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (stream_id, profile_id)
);

-- Whether the caller may watch a stream (and so join its lobby and chat).
create or replace function public.can_view_live_stream(p_stream_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1
    from public.live_streams s
    join public.profiles p on p.id = auth.uid() and p.zone_id = s.zone_id
    where s.id = p_stream_id
      and (
        'manage_livestreams' = any(p.caps)
        or s.audience = 'zone'
        or (s.audience = 'leaders' and p.role <> 'member')
        or (
          s.audience = 'chapters'
          and (
            exists (select 1 from public.members m where m.profile_id = p.id and m.church_id = any(s.church_ids))
            or (
              p.role <> 'member'
              and exists (select 1 from unnest(s.church_ids) cid where cid in (select public.current_user_scope_church_ids()))
            )
          )
        )
      )
  )
$$;

alter table live_streams enable row level security;
alter table live_stream_keys enable row level security;
alter table live_stream_messages enable row level security;
alter table live_stream_mutes enable row level security;

drop policy if exists "live_streams_select" on live_streams;
create policy "live_streams_select" on live_streams for select
  using (public.can_view_live_stream(id));
drop policy if exists "live_streams_insert" on live_streams;
create policy "live_streams_insert" on live_streams for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams'));
drop policy if exists "live_streams_update" on live_streams;
create policy "live_streams_update" on live_streams for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams'));
drop policy if exists "live_streams_delete" on live_streams;
create policy "live_streams_delete" on live_streams for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams'));

drop policy if exists "live_stream_keys_all" on live_stream_keys;
create policy "live_stream_keys_all" on live_stream_keys for all
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams'));

-- Chat: anyone who may watch reads it; they may post as themselves while the
-- stream isn't over, chat is on, and they haven't been muted. Only stream
-- managers moderate (soft delete via update).
drop policy if exists "live_stream_messages_select" on live_stream_messages;
create policy "live_stream_messages_select" on live_stream_messages for select
  using (public.can_view_live_stream(stream_id));
drop policy if exists "live_stream_messages_insert" on live_stream_messages;
create policy "live_stream_messages_insert" on live_stream_messages for insert
  with check (
    profile_id = auth.uid()
    and zone_id = public.current_user_zone_id()
    and deleted_at is null
    and public.can_view_live_stream(stream_id)
    and exists (select 1 from public.live_streams s where s.id = stream_id and s.status <> 'ended' and s.chat_enabled)
    and not exists (select 1 from public.live_stream_mutes mu where mu.stream_id = live_stream_messages.stream_id and mu.profile_id = auth.uid())
  );
drop policy if exists "live_stream_messages_update" on live_stream_messages;
create policy "live_stream_messages_update" on live_stream_messages for update
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams'))
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams'));

drop policy if exists "live_stream_mutes_select" on live_stream_mutes;
create policy "live_stream_mutes_select" on live_stream_mutes for select
  using (profile_id = auth.uid() or (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams')));
drop policy if exists "live_stream_mutes_insert" on live_stream_mutes;
create policy "live_stream_mutes_insert" on live_stream_mutes for insert
  with check (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams'));
drop policy if exists "live_stream_mutes_delete" on live_stream_mutes;
create policy "live_stream_mutes_delete" on live_stream_mutes for delete
  using (zone_id = public.current_user_zone_id() and public.current_user_can('manage_livestreams'));

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime: chat messages and stream status changes are pushed to the page
-- (Postgres Changes honour the RLS above), and the lobby's "who's here" uses
-- presence on a private channel named live:<stream id>, open only to those
-- who may watch that stream.
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_stream_messages') then
      alter publication supabase_realtime add table public.live_stream_messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'live_streams') then
      alter publication supabase_realtime add table public.live_streams;
    end if;
  end if;

  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "live_stream_presence_read" on realtime.messages';
    execute $p$
      create policy "live_stream_presence_read" on realtime.messages for select to authenticated
      using (
        realtime.topic() ~ '^live:[0-9a-f-]{36}$'
        and public.can_view_live_stream(substring(realtime.topic() from 6)::uuid)
      )
    $p$;
    execute 'drop policy if exists "live_stream_presence_write" on realtime.messages';
    execute $p$
      create policy "live_stream_presence_write" on realtime.messages for insert to authenticated
      with check (
        realtime.topic() ~ '^live:[0-9a-f-]{36}$'
        and public.can_view_live_stream(substring(realtime.topic() from 6)::uuid)
      )
    $p$;
  end if;
end
$$;

-- New capability for existing logins: Directors (and Zonal Secretaries for
-- Programmes) run streams by default — see defaultCapabilities in
-- src/lib/access.ts — unless it was revoked for that person.
update profiles set caps = array_append(caps, 'manage_livestreams')
where not ('manage_livestreams' = any(caps))
  and not ('manage_livestreams' = any(revoked_caps))
  and (
    position in ('zonal_director', 'assistant_zonal_director')
    or (position in ('zonal_secretary', 'deputy_zonal_secretary') and portfolio = 'programs')
  );

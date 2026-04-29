-- 002_open_lobbies.sql — public room lobbies for browsing rated games

create table if not exists open_lobbies (
  room_id text primary key,
  host_id uuid references auth.users(id) on delete cascade,
  host_name text,
  host_rating int,
  stake int default 0,
  time_control_sec int default 300,
  mode text default 'rated', -- 'rated' | 'casual'
  created_at timestamptz default now()
);

create index if not exists open_lobbies_created_idx on open_lobbies(created_at desc);

alter table open_lobbies enable row level security;

-- Anyone signed-in can read the public lobby list.
drop policy if exists "open_lobbies_read" on open_lobbies;
create policy "open_lobbies_read" on open_lobbies for select using (auth.uid() is not null);

-- Only the host can create / delete their own lobby row.
drop policy if exists "open_lobbies_insert" on open_lobbies;
create policy "open_lobbies_insert" on open_lobbies for insert
  with check (auth.uid() = host_id);

drop policy if exists "open_lobbies_delete" on open_lobbies;
create policy "open_lobbies_delete" on open_lobbies for delete
  using (auth.uid() = host_id);

-- Auto-cleanup: drop lobby rows older than 1 hour.
create or replace function cleanup_stale_lobbies() returns void
language sql as $$
  delete from open_lobbies where created_at < now() - interval '1 hour';
$$;

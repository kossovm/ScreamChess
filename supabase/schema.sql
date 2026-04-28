-- PsychoVoice Chess — Supabase schema
-- Run in the Supabase SQL editor.

create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  rating int default 1200,
  city text,
  country text,
  wins int default 0,
  losses int default 0,
  draws int default 0,
  created_at timestamptz default now()
);

create table if not exists games (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete set null,
  opponent_id uuid references auth.users(id) on delete set null,
  pgn text,
  moves jsonb,
  result text,
  mode text check (mode in ('local','ai','online')),
  difficulty int,
  city text,
  profile jsonb,
  rating_delta int default 0,
  created_at timestamptz default now()
);

create index if not exists games_user_idx on games(user_id);
create index if not exists games_created_idx on games(created_at desc);

create table if not exists psycho_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cognitive_style text,
  risk_tolerance int,
  stress_level int,
  impulsivity int,
  patience int,
  adaptability int,
  summary text,
  updated_at timestamptz default now()
);

create or replace view leaderboard as
select
  p.id,
  coalesce(p.username, 'anon-' || substr(p.id::text, 1, 6)) as username,
  p.rating, p.city, p.country, p.wins, p.losses, p.draws
from profiles p
order by p.rating desc;

-- Realtime room signaling table (if you prefer DB-based instead of broadcast)
create table if not exists rooms (
  id text primary key,
  white_id uuid,
  black_id uuid,
  status text default 'waiting',
  fen text default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  last_move jsonb,
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table games enable row level security;
alter table psycho_profiles enable row level security;

create policy "profiles read" on profiles for select using (true);
create policy "profiles update self" on profiles for update using (auth.uid() = id);
create policy "games read self" on games for select using (auth.uid() = user_id or user_id is null);
create policy "games insert" on games for insert with check (true);
create policy "psycho read self" on psycho_profiles for select using (auth.uid() = user_id);
create policy "psycho upsert self" on psycho_profiles for insert with check (auth.uid() = user_id);
create policy "psycho update self" on psycho_profiles for update using (auth.uid() = user_id);

-- 001_economy.sql — adds rating economy & matchmaking helpers
-- Run this in the Supabase SQL editor on top of the existing schema.

------------------------------------------------------------------
-- 1. Add columns to profiles
------------------------------------------------------------------
alter table profiles add column if not exists coins int default 5000;
alter table profiles add column if not exists coins_handout_used boolean default false;

-- New rating starts at 10. Existing users keep whatever they had.
alter table profiles alter column rating set default 10;

------------------------------------------------------------------
-- 2. Auto-create profile when a new auth user signs up
------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into profiles (id, username, rating, coins)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), 'player'),
    10,
    5000
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

------------------------------------------------------------------
-- 3. RPC: apply_match_result
-- Called by ONE player at the end of a rated game. Updates both
-- players' rating + coins + win/loss/draw counters atomically.
-- Result must be from the caller's perspective: 'win' | 'loss' | 'draw' | 'resign'
------------------------------------------------------------------
create or replace function apply_match_result(
  p_room_id text,
  p_opponent_id uuid,
  p_result text,
  p_stake int default 0
) returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_my_rating_delta int;
  v_opp_rating_delta int;
  v_my_coin_delta int;
  v_opp_coin_delta int;
  v_already_recorded boolean;
begin
  if v_user_id is null then
    return json_build_object('error', 'not_authenticated');
  end if;

  -- Idempotency: if this room was already recorded, skip silently.
  select exists(select 1 from rated_results where room_id = p_room_id) into v_already_recorded;
  if v_already_recorded then
    return json_build_object('ok', true, 'already_recorded', true);
  end if;

  -- Caller-side delta
  v_my_rating_delta := case
    when p_result = 'win'    then  2
    when p_result = 'draw'   then  1
    when p_result = 'loss'   then -1
    when p_result = 'resign' then -2
    else 0
  end;

  -- Opponent-side delta: mirror, except 'resign' for me means win for them
  v_opp_rating_delta := case
    when p_result = 'win'    then -1
    when p_result = 'draw'   then  1
    when p_result = 'loss'   then  2
    when p_result = 'resign' then  2
    else 0
  end;

  -- Coin transfer
  if p_stake > 0 then
    v_my_coin_delta := case
      when p_result in ('win')                      then  p_stake
      when p_result in ('loss','resign')            then -p_stake
      else 0
    end;
    v_opp_coin_delta := -v_my_coin_delta;
  else
    v_my_coin_delta := 0;
    v_opp_coin_delta := 0;
  end if;

  -- Apply to caller (rating clamped at 0)
  update profiles set
    rating = greatest(0, rating + v_my_rating_delta),
    wins   = wins   + case when p_result = 'win'                 then 1 else 0 end,
    losses = losses + case when p_result in ('loss','resign')    then 1 else 0 end,
    draws  = draws  + case when p_result = 'draw'                then 1 else 0 end,
    coins  = greatest(0, coins + v_my_coin_delta)
  where id = v_user_id;

  -- Apply to opponent
  update profiles set
    rating = greatest(0, rating + v_opp_rating_delta),
    wins   = wins   + case when p_result in ('loss','resign')    then 1 else 0 end,
    losses = losses + case when p_result = 'win'                 then 1 else 0 end,
    draws  = draws  + case when p_result = 'draw'                then 1 else 0 end,
    coins  = greatest(0, coins + v_opp_coin_delta)
  where id = p_opponent_id;

  -- Record so subsequent calls become no-ops
  insert into rated_results (room_id, white_id, black_id, result, stake, applied_at)
  values (p_room_id, v_user_id, p_opponent_id, p_result, p_stake, now())
  on conflict (room_id) do nothing;

  return json_build_object(
    'ok', true,
    'rating_delta', v_my_rating_delta,
    'coin_delta', v_my_coin_delta
  );
end;
$$;

------------------------------------------------------------------
-- 4. RPC: request_charity
-- Single-use 1000-coin handout for players with coins < 1000.
------------------------------------------------------------------
create or replace function request_charity()
returns json
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_used boolean;
  v_coins int;
begin
  if v_user_id is null then
    return json_build_object('error', 'not_authenticated');
  end if;

  select coins, coins_handout_used into v_coins, v_used
    from profiles where id = v_user_id;

  if v_used then return json_build_object('error', 'already_used'); end if;
  if v_coins is null then return json_build_object('error', 'no_profile'); end if;
  if v_coins >= 1000 then return json_build_object('error', 'not_eligible'); end if;

  update profiles set coins = coins + 1000, coins_handout_used = true
    where id = v_user_id;

  return json_build_object('ok', true, 'coins', v_coins + 1000);
end;
$$;

------------------------------------------------------------------
-- 5. Idempotency table for rated games
------------------------------------------------------------------
create table if not exists rated_results (
  room_id text primary key,
  white_id uuid references auth.users(id) on delete set null,
  black_id uuid references auth.users(id) on delete set null,
  result text,
  stake int default 0,
  applied_at timestamptz default now()
);
alter table rated_results enable row level security;
create policy "rated read self" on rated_results for select
  using (auth.uid() = white_id or auth.uid() = black_id);

------------------------------------------------------------------
-- 6. Backfill: create profiles for existing users that don't have one
------------------------------------------------------------------
insert into profiles (id, username, rating, coins)
select u.id, coalesce(split_part(u.email, '@', 1), 'player'), 10, 5000
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;

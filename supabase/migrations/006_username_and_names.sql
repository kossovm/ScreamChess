-- 006_username_and_names.sql
-- 1. Restore "username from email prefix" with collision-safe retry.
-- 2. Add first_name / last_name to profiles for the profile editor.

------------------------------------------------------------------
-- 1. New columns
------------------------------------------------------------------
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;

------------------------------------------------------------------
-- 2. Robust trigger: username from email, with up to 5 retries on conflict.
--    Always falls back to creating the row without a username if everything
--    else fails — never blocks auth.users insert.
------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_uname text;
  v_attempt int := 0;
begin
  v_base := lower(regexp_replace(
    coalesce(split_part(new.email, '@', 1), 'player'),
    '[^a-z0-9_.-]', '', 'g'
  ));
  if length(v_base) = 0 then v_base := 'player'; end if;

  v_uname := v_base;
  while v_attempt < 5 loop
    begin
      insert into profiles (id, username, rating, coins)
      values (new.id, v_uname, 10, 5000)
      on conflict (id) do nothing;
      return new;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      v_uname := v_base || '-' || substr(new.id::text, 1, 6);
    when others then
      raise warning 'profile insert non-unique error for %: %', new.id, sqlerrm;
      exit;
    end;
  end loop;

  -- Last-resort fallback: create row without username
  begin
    insert into profiles (id, rating, coins) values (new.id, 10, 5000)
    on conflict (id) do nothing;
  exception when others then
    raise warning 'final profile fallback failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

------------------------------------------------------------------
-- 3. Backfill: existing users without a username get one derived from their email.
------------------------------------------------------------------
do $$
declare
  r record;
  v_base text;
  v_uname text;
  v_attempt int;
begin
  for r in
    select u.id, u.email
    from auth.users u
    join profiles p on p.id = u.id
    where p.username is null or p.username = ''
  loop
    v_base := lower(regexp_replace(
      coalesce(split_part(r.email, '@', 1), 'player'),
      '[^a-z0-9_.-]', '', 'g'
    ));
    if length(v_base) = 0 then v_base := 'player'; end if;

    v_uname := v_base;
    v_attempt := 0;
    while v_attempt < 5 loop
      begin
        update profiles set username = v_uname where id = r.id;
        exit;
      exception when unique_violation then
        v_attempt := v_attempt + 1;
        v_uname := v_base || '-' || substr(r.id::text, 1, 6);
      when others then
        exit;
      end;
    end loop;
  end loop;
end $$;

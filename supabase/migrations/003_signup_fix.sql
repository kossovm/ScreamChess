-- 003_signup_fix.sql — fix "Database error saving new user".
-- The previous trigger tried to insert username = email-prefix; if two users
-- shared that prefix the unique constraint blew up the whole sign-up.
--
-- Run after 001 and 002.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Just create the row with defaults. Username is filled in later from the profile editor.
  insert into profiles (id, rating, coins)
  values (new.id, 10, 5000)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill profiles for any auth.users that failed the previous trigger.
insert into profiles (id, rating, coins)
select u.id, 10, 5000 from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

-- Allow users to update their own city/username via the profile page.
-- (Existing 'profiles update self' policy already covers this; included here for clarity.)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'profiles' and policyname = 'profiles update self') then
    create policy "profiles update self" on profiles for update using (auth.uid() = id);
  end if;
end $$;

-- 005_signup_robust.sql — make new-user trigger swallow any errors so a row
-- in profiles can never block authentication. We backfill missing rows below.
--
-- Run after 003.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into profiles (id, rating, coins)
    values (new.id, 10, 5000)
    on conflict (id) do nothing;
  exception when others then
    -- Don't block the auth.users insert if anything goes sideways.
    raise warning 'profile creation failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Make sure the trigger is wired up.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill any orphaned auth.users created during the broken window.
insert into profiles (id, rating, coins)
select u.id, 10, 5000 from auth.users u
where not exists (select 1 from profiles p where p.id = u.id);

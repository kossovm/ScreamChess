-- 004_lobby_update_policy.sql — let hosts UPDATE their own lobby row.
-- Without this, our upsert (INSERT ... ON CONFLICT DO UPDATE) hits the row-level
-- security policy and fails with 403.

drop policy if exists "open_lobbies_update" on open_lobbies;
create policy "open_lobbies_update" on open_lobbies for update
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

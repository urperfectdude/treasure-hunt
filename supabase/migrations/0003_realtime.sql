-- Tables never got added to Supabase's realtime publication, so every
-- postgres_changes subscription in the frontend (useRealtimeTable) was
-- connecting successfully but silently never receiving any change events —
-- the UI only ever updated on a manual refresh/refetch. New tables are NOT
-- auto-added to `supabase_realtime`; it has to be done explicitly.
--
-- Only the tables the frontend actually subscribes to (see
-- src/hooks/useGameData.ts and useHostSnapshot.ts) — not locations/clues/
-- game_events, which anon can't read anyway.
do $$
declare
  t text;
begin
  foreach t in array array['games', 'teams', 'players', 'clue_player_state', 'submissions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/functions";
import { useRealtimeTable } from "./useRealtimeTable";

// The host dashboard's full view (teams, locations, clues with target
// locations, submissions) — fetched through the host-snapshot Edge
// Function since it includes columns anon can't read directly. Re-fetched
// whenever any of the anon-readable signal tables change for this game, so
// the dashboard tracks new submissions/team progress within about a
// realtime round-trip without polling.
export function useHostSnapshot(gameId: string | null, hostToken: string | null) {
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof api.hostSnapshot>> | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!gameId || !hostToken) return;
    const data = await api.hostSnapshot({ gameId, hostToken });
    setSnapshot(data);
    setLoading(false);
  }, [gameId, hostToken]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useRealtimeTable("teams", "game_id", gameId, refetch);
  useRealtimeTable("submissions", "game_id", gameId, refetch);
  useRealtimeTable("clue_player_state", "game_id", gameId, refetch);

  return { snapshot, loading, refetch };
}

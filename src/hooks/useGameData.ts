import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRealtimeTable } from "./useRealtimeTable";
import type { Game, Player, PlayerClue, Submission, Team } from "../lib/types";

export function useGame(gameId: string | null) {
  const [game, setGame] = useState<Game | null>(null);

  const refetch = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("games").select("*").eq("id", gameId).single();
    setGame(data as Game | null);
  }, [gameId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useRealtimeTable("games", "id", gameId, refetch);

  return game;
}

export function useTeams(gameId: string | null) {
  const [teams, setTeams] = useState<Team[]>([]);

  const refetch = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("teams").select("*").eq("game_id", gameId).order("name");
    setTeams((data as Team[]) ?? []);
  }, [gameId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useRealtimeTable("teams", "game_id", gameId, refetch);

  return teams;
}

// The player's current clue: the most recent row in clue_player_state for
// their team, active or not (solved briefly shows the "correct!" state
// before the next insert replaces it as "active").
export function useActiveClue(teamId: string | null) {
  const [clue, setClue] = useState<PlayerClue | null>(null);

  const refetch = useCallback(async () => {
    if (!teamId) return;
    const { data } = await supabase
      .from("clue_player_state")
      .select("*")
      .eq("team_id", teamId)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    setClue(data as PlayerClue | null);
  }, [teamId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useRealtimeTable("clue_player_state", "team_id", teamId, refetch);

  return clue;
}

export function useTeam(teamId: string | null) {
  const [team, setTeam] = useState<Team | null>(null);

  const refetch = useCallback(async () => {
    if (!teamId) return;
    const { data } = await supabase.from("teams").select("*").eq("id", teamId).single();
    setTeam(data as Team | null);
  }, [teamId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useRealtimeTable("teams", "id", teamId, refetch);

  return team;
}

export function usePlayers(teamId: string | null) {
  const [players, setPlayers] = useState<Player[]>([]);

  const refetch = useCallback(async () => {
    if (!teamId) return;
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("team_id", teamId)
      .order("joined_at");
    setPlayers((data as Player[]) ?? []);
  }, [teamId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useRealtimeTable("players", "team_id", teamId, refetch);

  return players;
}

export function useLatestSubmission(clueId: string | null) {
  const [submission, setSubmission] = useState<Submission | null>(null);

  const refetch = useCallback(async () => {
    if (!clueId) return setSubmission(null);
    const { data } = await supabase
      .from("submissions")
      .select("*")
      .eq("clue_id", clueId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubmission(data as Submission | null);
  }, [clueId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useRealtimeTable("submissions", "clue_id", clueId, refetch);

  return submission;
}

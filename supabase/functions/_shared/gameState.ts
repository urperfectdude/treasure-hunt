import type { supabaseAdmin } from "./supabaseAdmin.ts";
import type { ClueLocation } from "./openai.ts";

type Db = ReturnType<typeof supabaseAdmin>;

export interface GameStateForClue {
  game: {
    id: string;
    property_id: string;
    difficulty: "easy" | "medium" | "hard" | "extreme";
    theme: string | null;
    clue_count: number;
    hints_allowed: boolean;
    final_location_id: string | null;
  };
  team: { id: string; completed_clues: number };
  candidateLocations: ClueLocation[];
  teamRecentLocationNames: string[];
  otherTeamsRecentLocationNames: string[];
  previousClueText: string | null;
  isFinal: boolean;
}

// Loads everything generateClue() needs to pick the next destination and
// write a clue for it, applying the anti-repetition / team-spread rules
// from the spec: exclude locations this team has already used, and prefer
// (by simply flagging in the prompt) locations other teams haven't just
// used either.
export async function loadGameStateForClue(
  db: Db,
  gameId: string,
  teamId: string,
): Promise<GameStateForClue> {
  const { data: game, error: gameError } = await db
    .from("games")
    .select(
      "id, property_id, difficulty, theme, clue_count, hints_allowed, final_location_id",
    )
    .eq("id", gameId)
    .single();
  if (gameError || !game) throw new Error("Game not found");

  const { data: team, error: teamError } = await db
    .from("teams")
    .select("id, completed_clues")
    .eq("id", teamId)
    .single();
  if (teamError || !team) throw new Error("Team not found");

  const nextSequence = team.completed_clues + 1;
  const isFinal = nextSequence >= game.clue_count;

  const { data: usedByTeam } = await db
    .from("clues")
    .select("target_location_id, clue_text, property_locations(name)")
    .eq("team_id", teamId)
    .order("sequence", { ascending: false });

  const usedLocationIds = new Set(
    (usedByTeam ?? []).map((c) => c.target_location_id),
  );
  const teamRecentLocationNames = (usedByTeam ?? [])
    .slice(0, 3)
    .map((c) => (c.property_locations as unknown as { name: string } | null)?.name)
    .filter((n): n is string => !!n);
  const previousClueText = usedByTeam?.[0]?.clue_text ?? null;

  const { data: recentOtherTeamClues } = await db
    .from("clues")
    .select("target_location_id, team_id, property_locations(name)")
    .eq("game_id", gameId)
    .neq("team_id", teamId)
    .eq("status", "active")
    .order("generated_at", { ascending: false })
    .limit(10);

  const otherTeamsRecentLocationNames = (recentOtherTeamClues ?? [])
    .map((c) => (c.property_locations as unknown as { name: string } | null)?.name)
    .filter((n): n is string => !!n);

  let candidateQuery = db
    .from("property_locations")
    .select("id, name, ai_description, host_description, tags")
    .eq("property_id", game.property_id)
    .eq("safe_for_game", true);

  if (usedLocationIds.size > 0) {
    candidateQuery = candidateQuery.not(
      "id",
      "in",
      `(${Array.from(usedLocationIds).join(",")})`,
    );
  }

  // On the final clue, force the target to the host-chosen final location
  // if one was set; otherwise AI picks from whatever's left (the "let AI
  // choose" path in the spec).
  if (isFinal && game.final_location_id) {
    candidateQuery = db
      .from("property_locations")
      .select("id, name, ai_description, host_description, tags")
      .eq("id", game.final_location_id);
  }

  const { data: candidateLocations, error: locError } = await candidateQuery;
  if (locError) throw locError;
  if (!candidateLocations || candidateLocations.length === 0) {
    throw new Error("No safe unused locations left for this team");
  }

  return {
    game,
    team,
    candidateLocations: candidateLocations.map((l) => ({
      id: l.id,
      name: l.name,
      ai_description: l.ai_description,
      host_description: l.host_description,
      tags: l.tags ?? [],
    })),
    teamRecentLocationNames,
    otherTeamsRecentLocationNames,
    previousClueText,
    isFinal,
  };
}

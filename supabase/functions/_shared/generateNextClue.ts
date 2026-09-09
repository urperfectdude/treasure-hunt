import type { supabaseAdmin } from "./supabaseAdmin.ts";
import { generateClue } from "./openai.ts";
import { loadGameStateForClue } from "./gameState.ts";

// The core AI engine (spec §9/§31): given a game+team, decides the one
// next clue. Called from start-game (clue #1), review-submission (after a
// correct answer), and adjust-clue's HTTP wrapper never calls this — it
// regenerates the *same* target instead. This is the only place a fresh
// clue with a newly-chosen target location gets created.
export async function generateNextClueForTeam(
  db: ReturnType<typeof supabaseAdmin>,
  gameId: string,
  teamId: string,
  hostInstruction: string | null = null,
) {
  const state = await loadGameStateForClue(db, gameId, teamId);

  const { data: lastSubmission } = await db
    .from("submissions")
    .select("host_feedback")
    .eq("team_id", teamId)
    .eq("host_decision", "incorrect")
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const generated = await generateClue({
    difficulty: state.game.difficulty,
    theme: state.game.theme,
    isFinal: state.isFinal,
    candidateLocations: state.candidateLocations,
    teamRecentLocationNames: state.teamRecentLocationNames,
    otherTeamsRecentLocationNames: state.otherTeamsRecentLocationNames,
    previousClueText: state.previousClueText,
    previousHostFeedback: lastSubmission?.host_feedback ?? null,
    hostInstruction,
    hintsAllowed: state.game.hints_allowed,
  });

  const sequence = state.team.completed_clues + 1;

  const { data: clue, error } = await db
    .from("clues")
    .insert({
      game_id: gameId,
      team_id: teamId,
      sequence,
      target_location_id: generated.targetLocationId,
      clue_text: generated.clueText,
      hint_text: generated.hintText,
      difficulty: state.game.difficulty,
      theme: state.game.theme,
      is_final: state.isFinal,
      ai_reasoning: generated.reasoning,
    })
    .select()
    .single();
  if (error) throw error;

  // Keep the player-safe projection in sync — see clue_player_state's
  // comment in the migration for why this can't just be a view.
  await db.from("clue_player_state").insert({
    id: clue.id,
    game_id: gameId,
    team_id: teamId,
    sequence,
    clue_text: clue.clue_text,
    hint_text: clue.hint_text,
    is_final: clue.is_final,
    generated_at: clue.generated_at,
  });

  await db.from("game_events").insert({
    game_id: gameId,
    team_id: teamId,
    type: "clue_generated",
    payload: { clue_id: clue.id, sequence, is_final: state.isFinal },
  });

  return clue;
}

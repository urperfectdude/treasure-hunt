import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { assertHostToken, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generateClue, type Difficulty } from "../_shared/openai.ts";

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard", "extreme"];

// Host controls (spec §20): regenerate / make easier / make harder / change
// style / custom instruction. Always regenerates for the SAME target
// location — a team mid-solve should never get redirected somewhere new.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { clueId, hostToken, action, styleInstruction, customInstruction } = await req.json();
    if (!clueId || !action) return errorResponse("clueId and action are required");

    const db = supabaseAdmin();

    const { data: clue, error: clueError } = await db
      .from("clues")
      .select("id, game_id, team_id, target_location_id, difficulty, theme, status")
      .eq("id", clueId)
      .single();
    if (clueError || !clue) return errorResponse("Clue not found", 404);
    if (clue.status !== "active") return errorResponse("Only the active clue can be adjusted");

    await assertHostToken(db, clue.game_id, hostToken);

    const { data: game } = await db
      .from("games")
      .select("hints_allowed")
      .eq("id", clue.game_id)
      .single();

    const { data: location } = await db
      .from("property_locations")
      .select("id, name, ai_description, host_description, tags")
      .eq("id", clue.target_location_id)
      .single();
    if (!location) return errorResponse("Target location not found", 404);

    let difficulty = clue.difficulty as Difficulty;
    let theme = clue.theme as string | null;
    let hostInstruction: string | null = null;

    if (action === "easier") {
      const idx = DIFFICULTY_ORDER.indexOf(difficulty);
      difficulty = DIFFICULTY_ORDER[Math.max(0, idx - 1)];
    } else if (action === "harder") {
      const idx = DIFFICULTY_ORDER.indexOf(difficulty);
      difficulty = DIFFICULTY_ORDER[Math.min(DIFFICULTY_ORDER.length - 1, idx + 1)];
    } else if (action === "style") {
      if (!styleInstruction) return errorResponse("styleInstruction is required for the style action");
      theme = styleInstruction;
    } else if (action === "custom") {
      if (!customInstruction) return errorResponse("customInstruction is required for the custom action");
      hostInstruction = customInstruction;
    } else if (action === "regenerate") {
      hostInstruction =
        "Write a completely different clue for the same destination — a different angle or phrasing than before.";
    } else {
      return errorResponse("Unknown action");
    }

    const generated = await generateClue({
      difficulty,
      theme,
      isFinal: false,
      candidateLocations: [
        {
          id: location.id,
          name: location.name,
          ai_description: location.ai_description,
          host_description: location.host_description,
          tags: location.tags ?? [],
        },
      ],
      teamRecentLocationNames: [],
      otherTeamsRecentLocationNames: [],
      previousClueText: null,
      previousHostFeedback: null,
      hostInstruction,
      hintsAllowed: game?.hints_allowed ?? true,
    });

    // Force the target back to the original location regardless of what
    // the model returned — with only one candidate it should match, but we
    // never let a mid-solve clue silently point somewhere new.
    const { data: updatedClue, error } = await db
      .from("clues")
      .update({
        clue_text: generated.clueText,
        hint_text: generated.hintText,
        difficulty,
        theme,
        target_location_id: location.id,
        ai_reasoning: generated.reasoning,
      })
      .eq("id", clueId)
      .select()
      .single();
    if (error) throw error;

    await db
      .from("clue_player_state")
      .update({ clue_text: updatedClue.clue_text, hint_text: updatedClue.hint_text })
      .eq("id", clueId);

    await db.from("game_events").insert({
      game_id: clue.game_id,
      team_id: clue.team_id,
      type: "clue_regenerated",
      payload: { clue_id: clueId, action },
    });

    return jsonResponse({ clue: updatedClue });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

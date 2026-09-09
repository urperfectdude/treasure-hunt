import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generateClue } from "../_shared/openai.ts";

// Player-facing (no host token — any player can request a hint for their
// own team's active clue). Returns the pre-generated hint if one already
// exists on the clue; otherwise generates one on demand. Always increments
// the team's hints_used counter exactly once per call.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { clueId, teamId } = await req.json();
    if (!clueId || !teamId) return errorResponse("clueId and teamId are required");

    const db = supabaseAdmin();

    const { data: clue, error: clueError } = await db
      .from("clues")
      .select("id, game_id, team_id, status, hint_text, difficulty, theme, target_location_id")
      .eq("id", clueId)
      .single();
    if (clueError || !clue) return errorResponse("Clue not found", 404);
    if (clue.team_id !== teamId) return errorResponse("Clue does not belong to this team", 403);
    if (clue.status !== "active") return errorResponse("This clue is no longer active");

    const { data: game } = await db
      .from("games")
      .select("hints_allowed")
      .eq("id", clue.game_id)
      .single();
    if (!game?.hints_allowed) return errorResponse("Hints are disabled for this game", 403);

    let hintText = clue.hint_text;

    if (!hintText) {
      const { data: location } = await db
        .from("property_locations")
        .select("id, name, ai_description, host_description, tags")
        .eq("id", clue.target_location_id)
        .single();

      if (location) {
        const generated = await generateClue({
          difficulty: clue.difficulty,
          theme: clue.theme,
          isFinal: false,
          candidateLocations: [{
            id: location.id,
            name: location.name,
            ai_description: location.ai_description,
            host_description: location.host_description,
            tags: location.tags ?? [],
          }],
          teamRecentLocationNames: [],
          otherTeamsRecentLocationNames: [],
          previousClueText: null,
          previousHostFeedback: null,
          hostInstruction: "Only produce a hintText for the existing clue — reuse a similar clueText, we only need the hint.",
          hintsAllowed: true,
        });
        hintText = generated.hintText;
        if (hintText) {
          await db.from("clues").update({ hint_text: hintText }).eq("id", clueId);
          await db.from("clue_player_state").update({ hint_text: hintText }).eq("id", clueId);
        }
      }
    }

    const { data: team } = await db
      .from("teams")
      .select("hints_used")
      .eq("id", teamId)
      .single();
    await db.from("teams").update({ hints_used: (team?.hints_used ?? 0) + 1 }).eq("id", teamId);

    await db.from("game_events").insert({
      game_id: clue.game_id,
      team_id: teamId,
      type: "hint_requested",
      payload: { clue_id: clueId },
    });

    return jsonResponse({ hintText });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { visualMatchScore } from "../_shared/openai.ts";

// Player-facing (no host token needed — any player can submit for their
// own team/clue). Goes through a function rather than a raw anon insert
// because computing the advisory AI visual-match score requires reading
// clues.target_location_id and property_locations.reference_image_url,
// both of which are locked to service_role only.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { clueId, teamId, playerId, photoUrl } = await req.json();
    if (!clueId || !teamId || !photoUrl) {
      return errorResponse("clueId, teamId and photoUrl are required");
    }

    const db = supabaseAdmin();

    const { data: clue, error: clueError } = await db
      .from("clues")
      .select("id, game_id, team_id, status, target_location_id")
      .eq("id", clueId)
      .single();
    if (clueError || !clue) return errorResponse("Clue not found", 404);
    if (clue.team_id !== teamId) return errorResponse("Clue does not belong to this team", 403);
    if (clue.status !== "active") return errorResponse("This clue is no longer active");

    const { data: location } = await db
      .from("property_locations")
      .select("reference_image_url, ai_description, host_description")
      .eq("id", clue.target_location_id)
      .single();

    let aiVisualMatch: number | null = null;
    try {
      aiVisualMatch = await visualMatchScore(
        photoUrl,
        location?.reference_image_url ?? null,
        location?.host_description || location?.ai_description || "",
      );
    } catch (err) {
      console.error("Visual match scoring failed:", err);
    }

    const { data: submission, error } = await db
      .from("submissions")
      .insert({
        game_id: clue.game_id,
        clue_id: clueId,
        team_id: teamId,
        player_id: playerId ?? null,
        photo_url: photoUrl,
        ai_visual_match: aiVisualMatch,
      })
      .select()
      .single();
    if (error) throw error;

    await db.from("game_events").insert({
      game_id: clue.game_id,
      team_id: teamId,
      type: "photo_submitted",
      payload: { submission_id: submission.id, clue_id: clueId },
    });

    return jsonResponse({ submission });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

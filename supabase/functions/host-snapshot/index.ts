import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { assertHostToken, supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// The host dashboard's one read path for anything sensitive (target
// locations, reference photos, AI reasoning) — none of that is in anon's
// reach via RLS. The client re-calls this whenever it gets a realtime
// nudge on the anon-readable tables (teams, submissions, clue_player_state)
// so the dashboard stays effectively live without exposing those columns
// to a raw table subscription.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { gameId, hostToken } = await req.json();
    if (!gameId) return errorResponse("gameId is required");

    const db = supabaseAdmin();
    await assertHostToken(db, gameId, hostToken);

    const { data: game, error: gameError } = await db
      .from("games")
      .select("*, properties(name)")
      .eq("id", gameId)
      .single();
    if (gameError || !game) return errorResponse("Game not found", 404);

    const [{ data: teams }, { data: locations }, { data: clues }, { data: submissions }] =
      await Promise.all([
        db.from("teams").select("*").eq("game_id", gameId).order("name"),
        db
          .from("property_locations")
          .select("*")
          .eq("property_id", game.property_id)
          .order("created_at"),
        db
          .from("clues")
          .select("*, property_locations(name)")
          .eq("game_id", gameId)
          .order("sequence", { ascending: false }),
        db
          .from("submissions")
          .select("*, clues(sequence, team_id, target_location_id, property_locations(name, reference_image_url))")
          .eq("game_id", gameId)
          .order("submitted_at", { ascending: false })
          .limit(50),
      ]);

    return jsonResponse({ game, teams, locations, clues, submissions });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

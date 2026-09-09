import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { assertHostToken, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generateNextClueForTeam } from "../_shared/generateNextClue.ts";

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
      .select("id, status, property_id")
      .eq("id", gameId)
      .single();
    if (gameError || !game) return errorResponse("Game not found", 404);
    if (game.status !== "lobby") return errorResponse("Game already started");

    const { data: locations } = await db
      .from("property_locations")
      .select("id")
      .eq("property_id", game.property_id)
      .eq("safe_for_game", true);
    if (!locations || locations.length === 0) {
      return errorResponse("This property has no safe locations mapped yet");
    }

    const { data: teams, error: teamsError } = await db
      .from("teams")
      .select("id")
      .eq("game_id", gameId);
    if (teamsError || !teams || teams.length === 0) {
      return errorResponse("No teams found for this game");
    }

    // Generate every team's first clue BEFORE flipping the game live — if
    // clue generation fails partway (e.g. an AI request error), the game
    // must stay in 'lobby' so the host can just retry Start, rather than
    // getting stuck 'active' with some teams missing a clue.
    const results = [];
    for (const team of teams) {
      const clue = await generateNextClueForTeam(db, gameId, team.id);
      results.push(clue);
    }

    const startedAt = new Date().toISOString();
    await db.from("games").update({ status: "active", started_at: startedAt }).eq("id", gameId);
    for (const team of teams) {
      await db.from("teams").update({ started_at: startedAt }).eq("id", team.id);
    }

    await db.from("game_events").insert({ game_id: gameId, type: "game_started", payload: {} });

    return jsonResponse({ status: "active", clues: results });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

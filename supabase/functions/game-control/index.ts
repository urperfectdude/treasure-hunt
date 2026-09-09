import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { assertHostToken, supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Small host-only game-level controls that don't warrant their own
// function: pause/resume, end game early, and toggle the player-visible
// leaderboard (default OFF, per spec §24, to preserve suspense).
type Action = "pause" | "resume" | "end" | "toggleLeaderboard";

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { gameId, hostToken, action } = await req.json() as {
      gameId: string;
      hostToken: string;
      action: Action;
    };
    if (!gameId || !action) return errorResponse("gameId and action are required");

    const db = supabaseAdmin();
    await assertHostToken(db, gameId, hostToken);

    if (action === "pause") {
      await db.from("games").update({ status: "paused" }).eq("id", gameId);
    } else if (action === "resume") {
      await db.from("games").update({ status: "active" }).eq("id", gameId);
    } else if (action === "end") {
      await db
        .from("games")
        .update({ status: "finished", finished_at: new Date().toISOString() })
        .eq("id", gameId);
    } else if (action === "toggleLeaderboard") {
      const { data: game } = await db
        .from("games")
        .select("show_leaderboard")
        .eq("id", gameId)
        .single();
      await db
        .from("games")
        .update({ show_leaderboard: !(game?.show_leaderboard ?? false) })
        .eq("id", gameId);
    } else {
      return errorResponse("Unknown action");
    }

    await db.from("game_events").insert({ game_id: gameId, type: `game_${action}`, payload: {} });

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

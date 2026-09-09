import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

function randomCode(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const TEAM_PRESETS = [
  { name: "Team Mango", icon: "🥭", color: "#f59e0b" },
  { name: "Team Coconut", icon: "🥥", color: "#3b82f6" },
  { name: "Team Tiger", icon: "🐯", color: "#22c55e" },
  { name: "Team Peacock", icon: "🦚", color: "#8b5cf6" },
  { name: "Team Banyan", icon: "🌳", color: "#ef4444" },
];

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { propertyId, numberOfTeams, difficulty, theme, clueCount, hintsAllowed } = await req.json();

    if (!propertyId) return errorResponse("propertyId is required");
    if (!numberOfTeams || numberOfTeams < 1 || numberOfTeams > 5) {
      return errorResponse("numberOfTeams must be between 1 and 5");
    }
    if (!["easy", "medium", "hard", "extreme"].includes(difficulty)) {
      return errorResponse("invalid difficulty");
    }
    if (!clueCount || clueCount < 1) {
      return errorResponse("clueCount must be a positive number");
    }

    const db = supabaseAdmin();

    const { data: property } = await db.from("properties").select("id").eq("id", propertyId).maybeSingle();
    if (!property) return errorResponse("Property not found", 404);

    let code = randomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: existing } = await db.from("games").select("id").eq("code", code).maybeSingle();
      if (!existing) break;
      code = randomCode();
    }

    const { data: game, error } = await db
      .from("games")
      .insert({
        code,
        property_id: propertyId,
        number_of_teams: numberOfTeams,
        difficulty,
        theme: theme || null,
        clue_count: clueCount,
        hints_allowed: hintsAllowed ?? true,
      })
      .select()
      .single();
    if (error) throw error;

    const teamsToInsert = TEAM_PRESETS.slice(0, numberOfTeams).map((t) => ({
      game_id: game.id,
      name: t.name,
      icon: t.icon,
      color: t.color,
    }));
    const { data: teams, error: teamsError } = await db
      .from("teams")
      .insert(teamsToInsert)
      .select();
    if (teamsError) throw teamsError;

    await db.from("game_events").insert({
      game_id: game.id,
      type: "game_created",
      payload: { numberOfTeams, difficulty, theme, clueCount },
    });

    return jsonResponse({ game, teams, hostToken: game.host_token });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

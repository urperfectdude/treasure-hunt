import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { assertHostToken, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generateNextClueForTeam } from "../_shared/generateNextClue.ts";

// Host-triggerable directly (e.g. a "force next clue" admin action), and
// also called in-process from start-game / review-submission. A direct
// client call must supply a valid hostToken.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { gameId, teamId, hostToken, hostInstruction } = await req.json();
    if (!gameId || !teamId) return errorResponse("gameId and teamId are required");

    const db = supabaseAdmin();
    await assertHostToken(db, gameId, hostToken);

    const clue = await generateNextClueForTeam(db, gameId, teamId, hostInstruction ?? null);
    return jsonResponse({ clue });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

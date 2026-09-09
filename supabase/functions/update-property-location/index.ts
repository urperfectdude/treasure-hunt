import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { assertPropertyToken, supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Creator-only edits to an already-mapped location — most commonly
// toggling safe_for_game ("do not use") after the fact, or fixing a typo
// in the description.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { locationId, hostToken, name, floor, area, hostDescription, safeForGame } = await req.json();
    if (!locationId) return errorResponse("locationId is required");

    const db = supabaseAdmin();

    const { data: location, error: locError } = await db
      .from("property_locations")
      .select("id, property_id")
      .eq("id", locationId)
      .single();
    if (locError || !location) return errorResponse("Location not found", 404);

    await assertPropertyToken(db, location.property_id, hostToken);

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (floor !== undefined) updates.floor = floor;
    if (area !== undefined) updates.area = area;
    if (hostDescription !== undefined) updates.host_description = hostDescription;
    if (safeForGame !== undefined) updates.safe_for_game = safeForGame;

    const { data: updated, error } = await db
      .from("property_locations")
      .update(updates)
      .eq("id", locationId)
      .select()
      .single();
    if (error) throw error;

    return jsonResponse({ location: updated });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

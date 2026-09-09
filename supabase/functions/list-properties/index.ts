import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Lets a host browse properties to reuse for a new game — anyone can list
// (this is the "choose an existing property" step), only the creator can
// modify one. Returns a safe-location count per property so the picker can
// show "12 locations mapped" without exposing what they are.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const db = supabaseAdmin();

    const { data: properties, error } = await db
      .from("properties")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const { data: locationCounts } = await db
      .from("property_locations")
      .select("property_id, safe_for_game");

    const counts = new Map<string, number>();
    for (const loc of locationCounts ?? []) {
      if (!loc.safe_for_game) continue;
      counts.set(loc.property_id, (counts.get(loc.property_id) ?? 0) + 1);
    }

    const result = (properties ?? []).map((p) => ({
      ...p,
      safeLocationCount: counts.get(p.id) ?? 0,
    }));

    return jsonResponse({ properties: result });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

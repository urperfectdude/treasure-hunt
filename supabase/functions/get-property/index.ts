import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Full detail for one property — used both to preview a property before
// picking it for a new game, and as the data source for the "manage
// locations" screen. `hostToken` is optional: pass it to also learn
// whether the caller is the creator (isOwner), which the client uses to
// decide whether to show add/edit controls. Viewing never requires it.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { propertyId, hostToken } = await req.json();
    if (!propertyId) return errorResponse("propertyId is required");

    const db = supabaseAdmin();

    const { data: property, error } = await db
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single();
    if (error || !property) return errorResponse("Property not found", 404);

    const { data: locations } = await db
      .from("property_locations")
      .select("*")
      .eq("property_id", propertyId)
      .order("created_at");

    const isOwner = !!hostToken && hostToken === property.host_token;

    return jsonResponse({
      property: { id: property.id, name: property.name, description: property.description, created_at: property.created_at },
      locations: locations ?? [],
      isOwner,
    });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

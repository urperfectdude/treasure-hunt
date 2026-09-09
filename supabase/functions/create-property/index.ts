import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

// Anyone can create a property (same as anyone can create a game) — it
// issues a fresh host_token returned only to the creator, required for all
// future edits (spec: "property modification only for the creator").
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { name, description } = await req.json();
    if (!name || !name.trim()) return errorResponse("name is required");

    const db = supabaseAdmin();
    const { data: property, error } = await db
      .from("properties")
      .insert({ name: name.trim(), description: description?.trim() || null })
      .select()
      .single();
    if (error) throw error;

    return jsonResponse({ property, hostToken: property.host_token });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

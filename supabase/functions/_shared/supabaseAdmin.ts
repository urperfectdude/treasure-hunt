import { createClient } from "jsr:@supabase/supabase-js@2";

// Service-role client — bypasses RLS entirely. Only ever used inside Edge
// Functions, never sent to the browser. Every function that mutates
// privileged tables (locations, clues, submissions.host_decision, games)
// goes through this client after validating the caller's host_token.
export function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function assertHostToken(
  db: ReturnType<typeof supabaseAdmin>,
  gameId: string,
  hostToken: string | undefined,
) {
  if (!hostToken) throw new Error("Missing host token");
  const { data, error } = await db
    .from("games")
    .select("host_token")
    .eq("id", gameId)
    .single();
  if (error || !data) throw new Error("Game not found");
  if (data.host_token !== hostToken) throw new Error("Invalid host token");
}

// Property modification (adding/editing locations) is restricted to
// whoever created it — the same bearer-token pattern as games, just at the
// property-library level. Anyone can still READ/use a property for a new
// game; only mutating its locations requires this token.
export async function assertPropertyToken(
  db: ReturnType<typeof supabaseAdmin>,
  propertyId: string,
  hostToken: string | undefined,
) {
  if (!hostToken) throw new Error("Missing host token");
  const { data, error } = await db
    .from("properties")
    .select("host_token")
    .eq("id", propertyId)
    .single();
  if (error || !data) throw new Error("Property not found");
  if (data.host_token !== hostToken) throw new Error("Only the creator can modify this property");
}

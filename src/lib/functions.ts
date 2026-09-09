import { supabase } from "./supabase";
import type {
  Game,
  HostClue,
  Property,
  PropertyLocation,
  PropertySummary,
  Submission,
  Team,
} from "./types";

// Thin wrapper around supabase.functions.invoke() that throws on error so
// callers can just `await` and catch, instead of checking `.error`
// everywhere. Accepts either a JSON-serializable body or FormData (used for
// the location-photo/voice upload).
async function invoke<T>(name: string, body: Record<string, unknown> | FormData): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(error.message ?? `${name} failed`);
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export const api = {
  createProperty: (body: { name: string; description?: string | null }) =>
    invoke<{ property: Property; hostToken: string }>("create-property", body),

  listProperties: () => invoke<{ properties: PropertySummary[] }>("list-properties", {}),

  getProperty: (body: { propertyId: string; hostToken?: string | null }) =>
    invoke<{ property: Property; locations: PropertyLocation[]; isOwner: boolean }>(
      "get-property",
      body,
    ),

  addLocationToProperty: (form: FormData) =>
    invoke<{ location: PropertyLocation }>("add-location-to-property", form),

  updatePropertyLocation: (body: {
    locationId: string;
    hostToken: string;
    name?: string;
    floor?: string | null;
    area?: string | null;
    hostDescription?: string | null;
    safeForGame?: boolean;
  }) => invoke<{ location: PropertyLocation }>("update-property-location", body),

  createGame: (body: {
    propertyId: string;
    numberOfTeams: number;
    difficulty: string;
    theme: string | null;
    clueCount: number;
    hintsAllowed: boolean;
  }) => invoke<{ game: { id: string; code: string }; teams: { id: string; name: string }[]; hostToken: string }>(
    "create-game",
    body,
  ),

  startGame: (gameId: string, hostToken: string) =>
    invoke<{ status: string }>("start-game", { gameId, hostToken }),

  submitPhoto: (body: { clueId: string; teamId: string; playerId: string | null; photoUrl: string }) =>
    invoke<{ submission: { id: string } }>("submit-photo", body),

  reviewSubmission: (body: {
    submissionId: string;
    decision: "correct" | "incorrect";
    hostFeedback?: string;
    hostToken: string;
  }) => invoke<{ decision: string; finished?: boolean; won?: boolean }>("review-submission", body),

  adjustClue: (body: {
    clueId: string;
    hostToken: string;
    action: "regenerate" | "easier" | "harder" | "style" | "custom";
    styleInstruction?: string;
    customInstruction?: string;
  }) => invoke<{ clue: unknown }>("adjust-clue", body),

  generateHint: (body: { clueId: string; teamId: string }) =>
    invoke<{ hintText: string | null }>("generate-hint", body),

  gameControl: (body: { gameId: string; hostToken: string; action: string }) =>
    invoke<{ ok: boolean }>("game-control", body),

  hostSnapshot: (body: { gameId: string; hostToken: string }) =>
    invoke<{
      game: Game & { properties: { name: string } | null };
      teams: Team[];
      locations: PropertyLocation[];
      clues: (HostClue & { property_locations: { name: string } | null })[];
      submissions: (Submission & {
        clues: {
          sequence: number;
          team_id: string;
          property_locations: { name: string; reference_image_url: string | null } | null;
        } | null;
      })[];
    }>("host-snapshot", body),
};

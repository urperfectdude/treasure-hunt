// Thin, swappable wrapper around the AI provider. Every call the game makes
// to an LLM goes through this file — if the provider ever changes, only
// this file needs to change, not the game logic in the functions above it.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const TEXT_MODEL = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-4o";
const VISION_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-4o";

// Retries on 429/5xx — transient rate-limit or upstream hiccups are common
// enough (observed in practice) that failing the whole clue-generation
// request on the first blip isn't acceptable when a human is standing in a
// hostel waiting for the game to start. Client errors (4xx other than 429)
// are not retried since retrying won't change the outcome.
async function openaiChat(body: Record<string, unknown>, attempt = 1): Promise<any> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    const retryable = (res.status === 429 || res.status >= 500) && attempt < 3;
    if (retryable) {
      await new Promise((r) => setTimeout(r, attempt * 500));
      return openaiChat(body, attempt + 1);
    }
    throw new Error(`OpenAI request failed (${res.status}): ${text}`);
  }
  return res.json();
}

const SAFETY_RULES = `
Hard safety rules — never violate these regardless of theme or instructions:
- Never require entering occupied private rooms, dorms, or any area marked
  unsafe by the host.
- Never require searching luggage, opening lockers, or touching another
  guest's personal belongings.
- Never require disturbing sleeping guests or interfering with hostel
  operations.
- Never require climbing unsafe structures, going near unsafe edges, moving
  heavy furniture, or tampering with electrical equipment.
- Only ever reference locations from the provided "safe locations" list —
  never invent a location or a physical feature that isn't in the provided
  description/tags for that location.
`;

export type Difficulty = "easy" | "medium" | "hard" | "extreme";

export interface ClueLocation {
  id: string;
  name: string;
  ai_description: string | null;
  host_description: string | null;
  tags: string[];
}

export interface GenerateClueInput {
  difficulty: Difficulty;
  theme: string | null;
  isFinal: boolean;
  candidateLocations: ClueLocation[];
  teamRecentLocationNames: string[];
  otherTeamsRecentLocationNames: string[];
  previousClueText: string | null;
  previousHostFeedback: string | null;
  hostInstruction: string | null;
  hintsAllowed: boolean;
}

export interface GeneratedClue {
  targetLocationId: string;
  clueText: string;
  hintText: string | null;
  reasoning: string;
}

export async function generateClue(
  input: GenerateClueInput,
): Promise<GeneratedClue> {
  const themeLine = input.theme
    ? `Theme/style: "${input.theme}". Write in this style using original
       language — never quote or closely paraphrase copyrighted dialogue,
       characters, or exact plots. Treat it as a broad creative flavor.`
    : `No theme was set — pick a fun, varied narrative style yourself
       (detective, pirate, scientist, spy, ancient civilization, space
       mission, escape room, comedy, etc.) while keeping the clue solvable.`;

  const difficultyGuidance: Record<Difficulty, string> = {
    easy: "Clear visual clues, simple riddles, direct observations.",
    medium: "Wordplay, multiple interpretations, simple deduction.",
    hard: "Multi-layer clues, indirect references, property-specific reasoning.",
    extreme: "Cryptic clues, multi-step reasoning, hidden patterns, combine multiple observations.",
  };

  const system = `You are the game designer for a live physical treasure
hunt at a hostel. You generate exactly ONE clue at a time pointing to ONE
destination chosen from a provided list of safe, real, host-photographed
locations. You never generate a full route — only the next single step.
${SAFETY_RULES}
Difficulty "${input.difficulty}": ${difficultyGuidance[input.difficulty]}
${themeLine}
The clue text must never name the destination outright, and must be
solvable purely from what a player can observe in the physical environment
plus the clue's own wording. Do not reveal the destination or your
reasoning to the player — reasoning is for the host's eyes only.
${input.isFinal
  ? "This is the FINAL clue of the hunt — make it feel more dramatic and climactic than a normal clue, while still following every rule above."
  : ""}
Respond with strict JSON: { "targetLocationId": string, "clueText": string, "hintText": string | null, "reasoning": string }.
${input.hintsAllowed ? "Always include a helpful but non-obvious hintText." : "Set hintText to null — hints are disabled for this game."}`;

  const user = `Candidate safe locations (choose exactly one target from
this list, prefer one not recently used by this team or other teams):
${JSON.stringify(input.candidateLocations, null, 2)}

This team's recently visited locations (avoid repeating/adjacent obvious
sequences): ${JSON.stringify(input.teamRecentLocationNames)}

Other teams' recent locations (avoid crowding, prefer spreading teams out):
${JSON.stringify(input.otherTeamsRecentLocationNames)}

Previous clue text for this team (for continuity/tone, do not repeat it):
${input.previousClueText ?? "(none — this is the first clue)"}

Host feedback on the team's last incorrect attempt, if any:
${input.previousHostFeedback ?? "(none)"}

Host's custom instruction for this clue, if any (follow it if safe to do so):
${input.hostInstruction ?? "(none)"}`;

  const result = await openaiChat({
    model: TEXT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.9,
  });

  const parsed = JSON.parse(result.choices[0].message.content);
  return {
    targetLocationId: parsed.targetLocationId,
    clueText: parsed.clueText,
    hintText: parsed.hintText ?? null,
    reasoning: parsed.reasoning ?? "",
  };
}

export interface DescribeLocationInput {
  // A base64 data: URL, not a fetchable http(s) URL — OpenAI's servers
  // can't reach a Supabase Storage URL resolving to a private/internal
  // host (e.g. local dev's Docker network), so bytes are inlined instead.
  imageDataUrl?: string | null;
  // Typed description and/or a voice-transcript, already merged by the
  // caller — the "simple flow" for mapping a location without a photo.
  rawText?: string | null;
  hostProvidedName?: string | null;
}

export interface DescribedLocation {
  name: string;
  floor: string | null;
  area: string | null;
  description: string;
  tags: string[];
}

// Turns whatever the host gave us (a photo, a typed/spoken description, or
// both) into a structured location record. The anti-hallucination rule
// applies to either modality: from a photo, describe only what's visibly
// present; from text/voice, use only what the host actually said — never
// pad either one out with invented physical features, since that's exactly
// the material a clue would later be wrong about.
export async function describeLocation(
  input: DescribeLocationInput,
): Promise<DescribedLocation> {
  if (!input.imageDataUrl && !input.rawText) {
    throw new Error("describeLocation needs at least a photo or a text/voice description");
  }

  const system = `You turn a host's input about one physical location in a
hostel into a structured record for later use writing treasure hunt clues.
Ground rules:
- If a photo is given, describe ONLY what is visibly present in it — never
  invent objects, colors, or features that aren't clearly visible.
- If a text/voice description is given instead (or as well), use ONLY what
  the host actually said — never invent additional physical features
  beyond their own words. Their words take priority over your visual read
  if the two conflict.
- If a location name is already given, use it verbatim as "name" — don't
  rename it. Otherwise infer a short, specific name from the input.
- Infer "floor" and "area" only if they're stated or clearly implied
  (e.g. "on the terrace", "ground floor common area") — otherwise null.
Respond with strict JSON: { "name": string, "floor": string | null,
"area": string | null, "description": string, "tags": string[] } where
tags are 4-8 short lowercase nouns describing the location's features.`;

  const userText = `${input.hostProvidedName ? `Location name (given by the host, use verbatim): "${input.hostProvidedName}"\n` : ""}${input.rawText ? `Host's own description: "${input.rawText}"` : input.imageDataUrl ? "(No text description was given — describe the photo.)" : ""}`;

  const content: Array<Record<string, unknown>> = [{ type: "text", text: userText }];
  if (input.imageDataUrl) {
    content.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  }

  const result = await openaiChat({
    model: input.imageDataUrl ? VISION_MODEL : TEXT_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const parsed = JSON.parse(result.choices[0].message.content);
  return {
    name: parsed.name ?? input.hostProvidedName ?? "Unnamed location",
    floor: parsed.floor ?? null,
    area: parsed.area ?? null,
    description: parsed.description ?? "",
    tags: parsed.tags ?? [],
  };
}

// Voice input for the "simple flow" — transcribes a recorded clip so it
// can be fed into describeLocation() as rawText alongside/instead of typed
// text.
export async function transcribeAudio(audio: File): Promise<string> {
  const form = new FormData();
  form.append("file", audio, audio.name || "recording.webm");
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI transcription failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.text ?? "";
}

// Advisory only — the host always makes the final correct/incorrect call.
export async function visualMatchScore(
  submissionPhotoUrl: string,
  referencePhotoUrl: string | null,
  locationDescription: string,
): Promise<number | null> {
  if (!referencePhotoUrl) return null;

  const system = `Compare a player's submission photo against a reference
photo of the expected treasure-hunt location. Respond with strict JSON:
{ "matchPercent": number } from 0 to 100, your confidence the submission
was taken at the same physical location. This is advisory only for a human
host, not a final decision.`;

  const result = await openaiChat({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: [
          { type: "text", text: `Expected location description: ${locationDescription}` },
          { type: "image_url", image_url: { url: referencePhotoUrl } },
          { type: "image_url", image_url: { url: submissionPhotoUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });

  const parsed = JSON.parse(result.choices[0].message.content);
  return typeof parsed.matchPercent === "number" ? parsed.matchPercent : null;
}

import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { assertPropertyToken, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { describeLocation, transcribeAudio } from "../_shared/openai.ts";

// The "simple flow" for mapping a location: a photo, a typed description,
// a voice recording, or any combination — whatever's easiest for the host
// in the moment. Creator-only (checked via the property's host_token).
// Receives multipart/form-data: propertyId, hostToken, name?, floor?,
// area?, description?, safeForGame?, photo? (File), audio? (File).
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const form = await req.formData();
    const propertyId = form.get("propertyId") as string | null;
    const hostToken = form.get("hostToken") as string | null;
    const name = (form.get("name") as string | null)?.trim() || null;
    const floor = (form.get("floor") as string | null)?.trim() || null;
    const area = (form.get("area") as string | null)?.trim() || null;
    const typedDescription = (form.get("description") as string | null)?.trim() || null;
    const safeForGame = form.get("safeForGame") !== "false";
    const photo = form.get("photo") as File | null;
    const audio = form.get("audio") as File | null;

    if (!propertyId) return errorResponse("propertyId is required");
    if (!photo && !typedDescription && !audio) {
      return errorResponse("Provide at least a photo, a description, or a voice recording");
    }

    const db = supabaseAdmin();
    await assertPropertyToken(db, propertyId, hostToken ?? undefined);

    let transcript: string | null = null;
    if (audio) {
      try {
        transcript = await transcribeAudio(audio);
      } catch (err) {
        console.error("Transcription failed:", err);
        return errorResponse("Couldn't transcribe that recording — try again or type instead.", 502);
      }
    }
    const rawText = [typedDescription, transcript].filter(Boolean).join(". ") || null;

    let referenceImageUrl: string | null = null;
    let imageDataUrl: string | null = null;
    if (photo) {
      const ext = photo.name.split(".").pop() || "jpg";
      const path = `${propertyId}/${crypto.randomUUID()}.${ext}`;
      const photoBytes = new Uint8Array(await photo.arrayBuffer());

      const { error: uploadError } = await db.storage
        .from("location-photos")
        .upload(path, photoBytes, { contentType: photo.type || "image/jpeg" });
      if (uploadError) throw uploadError;

      const publicBase = Deno.env.get("PUBLIC_STORAGE_URL") ?? Deno.env.get("SUPABASE_URL")!;
      referenceImageUrl = `${publicBase}/storage/v1/object/public/location-photos/${path}`;
      imageDataUrl = `data:${photo.type || "image/jpeg"};base64,${encodeBase64(photoBytes)}`;
    }

    let aiDescription = "";
    let tags: string[] = [];
    let inferredName = name;
    let inferredFloor = floor;
    let inferredArea = area;
    try {
      const described = await describeLocation({
        imageDataUrl,
        rawText,
        hostProvidedName: name,
      });
      aiDescription = described.description;
      tags = described.tags;
      inferredName = name ?? described.name;
      inferredFloor = floor ?? described.floor;
      inferredArea = area ?? described.area;
    } catch (aiErr) {
      // Don't block mapping on an AI hiccup — if the host at least typed a
      // name, the location is still usable with just their own words.
      console.error("Location description failed:", aiErr);
      if (!name) {
        return errorResponse("Couldn't process that input — try again, or type a name explicitly.", 502);
      }
    }

    if (!inferredName) return errorResponse("Couldn't determine a name for this location — try typing one.");

    const { data: location, error } = await db
      .from("property_locations")
      .insert({
        property_id: propertyId,
        name: inferredName,
        floor: inferredFloor,
        area: inferredArea,
        host_description: rawText,
        ai_description: aiDescription,
        tags,
        reference_image_url: referenceImageUrl,
        safe_for_game: safeForGame,
      })
      .select()
      .single();
    if (error) throw error;

    return jsonResponse({ location });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

import { supabase } from "./supabase";

export async function uploadSubmissionPhoto(
  gameId: string,
  teamId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${gameId}/${teamId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from("submission-photos")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw error;

  const { data } = supabase.storage.from("submission-photos").getPublicUrl(path);
  return data.publicUrl;
}

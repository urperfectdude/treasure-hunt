import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadPropertySession } from "../../lib/session";
import { api } from "../../lib/functions";
import Button from "../../components/Button";
import VoiceRecorder from "../../components/VoiceRecorder";
import type { PropertyLocation } from "../../lib/types";

type Mode = "photo" | "text" | "voice";

export default function PropertyDetail() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const session = propertyId ? loadPropertySession(propertyId) : null;

  const [propertyName, setPropertyName] = useState("");
  const [locations, setLocations] = useState<PropertyLocation[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<Mode>("photo");
  const [name, setName] = useState("");
  const [floor, setFloor] = useState("");
  const [area, setArea] = useState("");
  const [description, setDescription] = useState("");
  const [safe, setSafe] = useState(true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    if (!propertyId) return;
    const { property, locations, isOwner } = await api.getProperty({
      propertyId,
      hostToken: session?.hostToken ?? null,
    });
    setPropertyName(property.name);
    setLocations(locations);
    setIsOwner(isOwner);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setPhoto(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function resetForm() {
    setName("");
    setFloor("");
    setArea("");
    setDescription("");
    setSafe(true);
    setPhoto(null);
    setPreview(null);
    setAudio(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleAdd() {
    if (!propertyId || !session) return;
    if (mode === "photo" && !photo) return;
    if (mode === "text" && !description.trim()) return;
    if (mode === "voice" && !audio) return;

    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("propertyId", propertyId);
      form.append("hostToken", session.hostToken);
      if (name.trim()) form.append("name", name.trim());
      if (floor.trim()) form.append("floor", floor.trim());
      if (area.trim()) form.append("area", area.trim());
      form.append("safeForGame", String(safe));
      if (mode === "photo" && photo) form.append("photo", photo);
      if (mode === "text" && description.trim()) form.append("description", description.trim());
      if (mode === "voice" && audio) form.append("audio", audio);

      await api.addLocationToProperty(form);
      await refresh();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that location.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSafe(loc: PropertyLocation) {
    if (!session) return;
    await api.updatePropertyLocation({
      locationId: loc.id,
      hostToken: session.hostToken,
      safeForGame: !loc.safe_for_game,
    });
    refresh();
  }

  const safeCount = locations.filter((l) => l.safe_for_game).length;

  if (!propertyId) return null;
  if (loading) return <div className="p-8 text-center text-stone-400">Loading…</div>;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{propertyName}</h1>
        <p className="mt-1 text-sm text-stone-500">
          {isOwner
            ? "Walk around and add each location — photo, typed description, or voice, whichever's easiest."
            : "You're viewing a property mapped by someone else — only its creator can add or edit locations."}
        </p>
      </div>

      {isOwner && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex gap-2">
            {(["photo", "text", "voice"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full border-2 py-2 text-sm font-semibold capitalize transition ${
                  mode === m ? "border-amber-500 bg-amber-50 text-amber-700" : "border-stone-200 text-stone-600"
                }`}
              >
                {m === "photo" ? "📷 Photo" : m === "text" ? "✍️ Text" : "🎙️ Voice"}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <input
              className="rounded-xl border border-stone-300 px-4 py-3"
              placeholder="Name (optional — AI will infer one)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex gap-3">
              <input
                className="w-1/2 rounded-xl border border-stone-300 px-4 py-3"
                placeholder="Floor (optional)"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
              />
              <input
                className="w-1/2 rounded-xl border border-stone-300 px-4 py-3"
                placeholder="Area (optional)"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              />
            </div>

            {mode === "photo" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFile}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-stone-300 py-6 text-center text-stone-500"
                >
                  {preview ? (
                    <img src={preview} alt="" className="mx-auto h-32 rounded-lg object-cover" />
                  ) : (
                    "📷 Take a photo of this location"
                  )}
                </button>
              </>
            )}

            {mode === "text" && (
              <textarea
                className="rounded-xl border border-stone-300 px-4 py-3"
                placeholder="Describe this location in your own words…"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}

            {mode === "voice" && <VoiceRecorder onRecorded={setAudio} />}

            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input type="checkbox" checked={safe} onChange={(e) => setSafe(e.target.checked)} />
              Safe for players (uncheck for "do not use")
            </label>

            <Button
              disabled={
                saving ||
                (mode === "photo" && !photo) ||
                (mode === "text" && !description.trim()) ||
                (mode === "voice" && !audio)
              }
              onClick={handleAdd}
            >
              {saving ? "Adding…" : "+ Add Location"}
            </Button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-stone-600">
          {safeCount} safe location{safeCount === 1 ? "" : "s"} mapped
        </p>
        <div className="flex flex-col gap-2">
          {locations.map((loc) => (
            <div key={loc.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
              {loc.reference_image_url && (
                <img src={loc.reference_image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-stone-800">{loc.name}</p>
                <p className="line-clamp-1 text-xs text-stone-500">
                  {loc.host_description || loc.ai_description}
                </p>
              </div>
              {isOwner ? (
                <button
                  onClick={() => toggleSafe(loc)}
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    loc.safe_for_game ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  }`}
                >
                  {loc.safe_for_game ? "safe" : "do not use"}
                </button>
              ) : (
                !loc.safe_for_game && (
                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-600">
                    do not use
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="secondary"
        disabled={safeCount === 0}
        onClick={() => navigate(`/host/property/${propertyId}/new-game`)}
      >
        Create Hunt with This Property →
      </Button>
    </div>
  );
}

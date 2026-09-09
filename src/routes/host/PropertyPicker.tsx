import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/functions";
import { savePropertySession } from "../../lib/session";
import Button from "../../components/Button";
import type { PropertySummary } from "../../lib/types";

export default function PropertyPicker() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProperties()
      .then(({ properties }) => setProperties(properties))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!name.trim()) return;
    setError(null);
    try {
      const { property, hostToken } = await api.createProperty({
        name: name.trim(),
        description: description.trim() || null,
      });
      savePropertySession({ propertyId: property.id, hostToken });
      navigate(`/host/property/${property.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that property.");
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Choose a Property</h1>
        <p className="mt-1 text-sm text-stone-500">
          Reuse one you've already mapped, or map a new one from scratch.
        </p>
      </div>

      {loading && <p className="text-center text-stone-400">Loading…</p>}

      <div className="flex flex-col gap-2">
        {properties.map((p) => (
          <button
            key={p.id}
            onClick={() => navigate(`/host/property/${p.id}`)}
            className="rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md"
          >
            <p className="font-semibold text-stone-800">{p.name}</p>
            {p.description && <p className="mt-1 text-sm text-stone-500">{p.description}</p>}
            <p className="mt-1 text-xs text-stone-400">{p.safeLocationCount} locations mapped</p>
          </button>
        ))}
      </div>

      {!creating ? (
        <Button variant="ghost" onClick={() => setCreating(true)}>
          + Create New Property
        </Button>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <input
            className="rounded-xl border border-stone-300 px-4 py-3"
            placeholder="Property name (e.g. Sunset Hostel)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            className="rounded-xl border border-stone-300 px-4 py-3"
            placeholder="Optional description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button disabled={!name.trim()} onClick={handleCreate}>
            Create Property →
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

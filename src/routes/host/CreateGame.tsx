import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../lib/functions";
import { saveHostSession } from "../../lib/session";
import Button from "../../components/Button";
import type { Difficulty } from "../../lib/types";

const CLUE_COUNT_OPTIONS = [5, 8, 10, 15];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard", "extreme"];

export default function CreateGame() {
  const { propertyId } = useParams();
  const navigate = useNavigate();

  const [numberOfTeams, setNumberOfTeams] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [theme, setTheme] = useState("");
  const [clueCount, setClueCount] = useState(8);
  const [customClueCount, setCustomClueCount] = useState("");
  const [hintsAllowed, setHintsAllowed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!propertyId) return;
    setError(null);
    setLoading(true);
    try {
      const finalClueCount = customClueCount ? parseInt(customClueCount, 10) : clueCount;
      const { game, hostToken } = await api.createGame({
        propertyId,
        numberOfTeams,
        difficulty,
        theme: theme.trim() || null,
        clueCount: finalClueCount,
        hintsAllowed,
      });
      saveHostSession({ gameId: game.id, hostToken });
      navigate(`/host/${game.id}/lobby`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the hunt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-bold text-stone-900">Create New Hunt</h1>

      <Field label="Number of teams">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} selected={numberOfTeams === n} onClick={() => setNumberOfTeams(n)}>
              {n}
            </Chip>
          ))}
        </div>
        {numberOfTeams === 1 && (
          <p className="mt-1 text-xs text-stone-400">
            Single-team games run as an Adventure Mode with no leaderboard.
          </p>
        )}
      </Field>

      <Field label="Difficulty">
        <div className="flex flex-wrap gap-2">
          {DIFFICULTIES.map((d) => (
            <Chip key={d} selected={difficulty === d} onClick={() => setDifficulty(d)}>
              {d}
            </Chip>
          ))}
        </div>
      </Field>

      <Field label="Number of clues">
        <div className="flex flex-wrap gap-2">
          {CLUE_COUNT_OPTIONS.map((c) => (
            <Chip
              key={c}
              selected={!customClueCount && clueCount === c}
              onClick={() => {
                setClueCount(c);
                setCustomClueCount("");
              }}
            >
              {c}
            </Chip>
          ))}
          <input
            className="w-20 rounded-full border border-stone-300 px-3 py-2 text-center text-sm"
            placeholder="Custom"
            value={customClueCount}
            onChange={(e) => setCustomClueCount(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </Field>

      <Field label="Theme / style (optional)">
        <input
          className="w-full rounded-xl border border-stone-300 px-4 py-3"
          placeholder="Make it feel like a Bollywood mystery"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <input
          type="checkbox"
          checked={hintsAllowed}
          onChange={(e) => setHintsAllowed(e.target.checked)}
        />
        Allow players to request hints
      </label>

      <Button disabled={loading || !propertyId} onClick={handleCreate}>
        {loading ? "Creating…" : "Create Hunt →"}
      </Button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-stone-600">{label}</p>
      {children}
    </div>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border-2 px-4 py-2 text-sm font-semibold capitalize transition ${
        selected ? "border-amber-500 bg-amber-50 text-amber-700" : "border-stone-200 text-stone-600"
      }`}
    >
      {children}
    </button>
  );
}

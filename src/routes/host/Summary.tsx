import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadHostSession } from "../../lib/session";
import { useHostSnapshot } from "../../hooks/useHostSnapshot";
import Button from "../../components/Button";

function formatDuration(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return "—";
  const seconds = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Summary() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const session = gameId ? loadHostSession(gameId) : null;
  const { snapshot } = useHostSnapshot(gameId ?? null, session?.hostToken ?? null);
  const [shared, setShared] = useState(false);

  if (!gameId || !session || !snapshot) {
    return <div className="p-8 text-center text-stone-400">Loading summary…</div>;
  }

  const { game, teams } = snapshot;
  const winner = teams.find((t) => t.winner);
  const sorted = [...teams].sort((a, b) => b.completed_clues - a.completed_clues);

  async function handleShare() {
    const lines = [
      `🏆 ${game.properties?.name ?? "Treasure Hunt"} — results (game ${game.code})`,
      ...(winner ? [`Winner: ${winner.icon} ${winner.name}`] : []),
      ...sorted.map(
        (t, i) => `${["🥇", "🥈", "🥉"][i] ?? "•"} ${t.name} — ${t.completed_clues} clues`,
      ),
    ];
    const text = lines.join("\n");

    if (navigator.share) {
      try {
        await navigator.share({ title: "Treasure Hunt Results", text });
        return;
      } catch {
        // user cancelled the share sheet — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(text);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-10">
      <h1 className="text-center text-2xl font-bold text-stone-900">🏆 Game Summary</h1>

      {winner && (
        <div className="rounded-2xl bg-amber-50 p-5 text-center">
          <p className="text-sm font-semibold text-amber-700">WINNER</p>
          <p className="text-xl font-bold" style={{ color: winner.color ?? undefined }}>
            {winner.icon} {winner.name}
          </p>
          <p className="text-sm text-stone-500">
            {formatDuration(winner.started_at, winner.completed_at)}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {sorted.map((team, i) => (
          <div key={team.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
            <div>
              <p className="font-semibold" style={{ color: team.color ?? undefined }}>
                {["🥇", "🥈", "🥉"][i] ?? "•"} {team.icon} {team.name}
              </p>
              <p className="text-xs text-stone-500">
                {team.completed_clues} clues · {team.hints_used} hints · {team.failed_attempts} incorrect
              </p>
            </div>
            <p className="text-sm font-medium text-stone-600">
              {formatDuration(team.started_at, team.completed_at)}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Button variant="ghost" onClick={handleShare}>
          {shared ? "Copied to clipboard!" : "Share Results"}
        </Button>
        <Button onClick={() => navigate(`/host/property/${game.property_id}/new-game`)}>
          New Game →
        </Button>
      </div>
    </div>
  );
}

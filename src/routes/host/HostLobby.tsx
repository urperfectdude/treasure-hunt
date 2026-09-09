import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { loadHostSession } from "../../lib/session";
import { useGame, useTeams } from "../../hooks/useGameData";
import { api } from "../../lib/functions";
import Button from "../../components/Button";

export default function HostLobby() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const session = gameId ? loadHostSession(gameId) : null;

  const game = useGame(gameId ?? null);
  const teams = useTeams(gameId ?? null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!gameId || !session || !game) return null;

  const joinUrl = `${window.location.origin}${window.location.pathname}#/join/${game.code}`;

  async function handleStart() {
    if (!session) return;
    setStarting(true);
    setError(null);
    try {
      await api.startGame(gameId!, session.hostToken);
      navigate(`/host/${gameId}/live`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the hunt.");
      setStarting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-10 text-center">
      <div>
        <h1 className="text-xl font-bold text-stone-900">Treasure Hunt</h1>
        <p className="mt-1 text-sm text-stone-500">Players join with the code or QR below</p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <QRCodeSVG value={joinUrl} size={200} />
      </div>

      <div>
        <p className="text-xs font-semibold tracking-widest text-stone-400">GAME CODE</p>
        <p className="text-4xl font-black tracking-widest text-stone-900">{game.code}</p>
      </div>

      <div className="w-full">
        <p className="mb-2 text-sm font-medium text-stone-600">Teams</p>
        <div className="flex flex-col gap-2">
          {teams.map((t) => (
            <div key={t.id} className="rounded-xl bg-white px-4 py-3 text-left shadow-sm">
              <span className="mr-2 text-xl">{t.icon}</span>
              <span className="font-semibold" style={{ color: t.color ?? undefined }}>
                {t.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Button disabled={starting} onClick={handleStart} className="w-full">
        {starting ? "Starting…" : "Start Hunt"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

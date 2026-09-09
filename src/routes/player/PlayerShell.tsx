import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadPlayerSession } from "../../lib/session";
import { useActiveClue, useGame, useTeam } from "../../hooks/useGameData";
import ClueScreen from "./ClueScreen";
import ProgressTab from "./ProgressTab";
import TeamTab from "./TeamTab";

type Tab = "clue" | "progress" | "team";

export default function PlayerShell() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("clue");

  const session = gameId ? loadPlayerSession(gameId) : null;

  useEffect(() => {
    if (gameId && !session) navigate(`/join`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, session]);

  const game = useGame(gameId ?? null);
  const team = useTeam(session?.teamId ?? null);
  const clue = useActiveClue(session?.teamId ?? null);

  if (!session || !gameId) return null;
  if (!game || !team) return <Loading />;

  if (game.status === "lobby") {
    return (
      <Centered>
        <p className="text-5xl">⏳</p>
        <h2 className="mt-4 text-xl font-bold">Waiting for the host to start…</h2>
        <p className="mt-2 text-stone-500">
          You're in as <span className="font-semibold">{session.nickname}</span> on{" "}
          <span className="font-semibold" style={{ color: team.color ?? undefined }}>
            {team.icon} {team.name}
          </span>
        </p>
      </Centered>
    );
  }

  if (game.status === "paused") {
    return (
      <Centered>
        <p className="text-5xl">⏸️</p>
        <h2 className="mt-4 text-xl font-bold">Hunt paused</h2>
        <p className="mt-2 text-stone-500">The Game Master will resume shortly.</p>
      </Centered>
    );
  }

  if (game.status === "finished" || team.completed_at) {
    return (
      <Centered>
        <p className="text-6xl">{team.winner ? "🏆" : "🎉"}</p>
        <h2 className="mt-4 text-2xl font-bold">
          {team.winner ? `${team.name.toUpperCase()} WINS!` : "Treasure Found!"}
        </h2>
        <p className="mt-2 text-stone-500">
          {team.completed_clues} clues completed · {team.hints_used} hints used
        </p>
      </Centered>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white px-4 py-3 text-center">
        <p className="text-xs font-bold tracking-widest text-stone-400">
          TREASURE HUNT
        </p>
        <p className="font-semibold" style={{ color: team.color ?? undefined }}>
          {team.icon} {team.name}
        </p>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {tab === "clue" && clue && (
          <ClueScreen
            gameId={gameId}
            clue={clue}
            team={team}
            playerId={session.playerId}
            clueCount={game.clue_count}
            hintsAllowed={game.hints_allowed}
          />
        )}
        {tab === "clue" && !clue && <Loading />}
        {tab === "progress" && <ProgressTab team={team} clueCount={game.clue_count} />}
        {tab === "team" && <TeamTab team={team} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 flex border-t border-stone-200 bg-white">
        {(["clue", "progress", "team"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-4 text-sm font-semibold capitalize ${
              tab === t ? "text-amber-600" : "text-stone-400"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-stone-400">Loading…</div>
  );
}

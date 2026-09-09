import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { savePlayerSession } from "../lib/session";
import Button from "../components/Button";
import type { Game, Team } from "../lib/types";

export default function Join() {
  const { code: codeParam } = useParams();
  const navigate = useNavigate();

  const [code, setCode] = useState(codeParam?.toUpperCase() ?? "");
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function lookupGame(gameCode: string) {
    setError(null);
    setLoading(true);
    const { data: gameData } = await supabase
      .from("games")
      .select("*")
      .eq("code", gameCode.toUpperCase())
      .maybeSingle();

    if (!gameData) {
      setError("No hunt found with that code.");
      setGame(null);
      setLoading(false);
      return;
    }
    if (gameData.status !== "lobby") {
      setError("This hunt has already started or finished.");
      setGame(null);
      setLoading(false);
      return;
    }

    setGame(gameData as Game);
    const { data: teamsData } = await supabase
      .from("teams")
      .select("*")
      .eq("game_id", gameData.id)
      .order("name");
    setTeams((teamsData as Team[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (codeParam) lookupGame(codeParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  async function handleJoin() {
    if (!game || !selectedTeamId || !nickname.trim()) return;
    setError(null);
    setLoading(true);

    const { data: player, error: joinError } = await supabase
      .from("players")
      .insert({ team_id: selectedTeamId, nickname: nickname.trim() })
      .select()
      .single();

    if (joinError || !player) {
      setError("Couldn't join — the hunt may have just started.");
      setLoading(false);
      return;
    }

    savePlayerSession({
      gameId: game.id,
      teamId: selectedTeamId,
      playerId: player.id,
      nickname: nickname.trim(),
    });
    navigate(`/play/${game.id}`);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <h1 className="text-center text-2xl font-bold text-stone-900">Join the Hunt</h1>

      {!game && (
        <div className="flex flex-col gap-3">
          <input
            className="rounded-xl border border-stone-300 px-4 py-4 text-center text-2xl font-bold tracking-widest uppercase"
            placeholder="GAME CODE"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button disabled={code.length < 4 || loading} onClick={() => lookupGame(code)}>
            {loading ? "Looking up…" : "Find Hunt"}
          </Button>
        </div>
      )}

      {game && (
        <div className="flex flex-col gap-4">
          <p className="text-center text-stone-500">
            Joining <span className="font-semibold text-stone-800">{game.code}</span>
          </p>

          <div>
            <p className="mb-2 text-sm font-medium text-stone-600">Pick your team</p>
            <div className="grid grid-cols-2 gap-2">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={`rounded-xl border-2 px-3 py-4 text-center font-semibold transition ${
                    selectedTeamId === team.id
                      ? "border-amber-500 bg-amber-50"
                      : "border-stone-200 bg-white"
                  }`}
                  style={{ color: team.color ?? undefined }}
                >
                  <span className="mr-1 text-xl">{team.icon}</span>
                  {team.name}
                </button>
              ))}
            </div>
          </div>

          <input
            className="rounded-xl border border-stone-300 px-4 py-4 text-lg"
            placeholder="Your nickname"
            maxLength={24}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />

          <Button
            disabled={!selectedTeamId || !nickname.trim() || loading}
            onClick={handleJoin}
          >
            {loading ? "Joining…" : "Join Team"}
          </Button>
        </div>
      )}

      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}

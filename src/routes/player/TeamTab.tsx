import { usePlayers } from "../../hooks/useGameData";
import type { Team } from "../../lib/types";

export default function TeamTab({ team }: { team: Team }) {
  const players = usePlayers(team.id);

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="text-center">
        <p className="text-5xl">{team.icon}</p>
        <h2 className="mt-2 text-2xl font-bold" style={{ color: team.color ?? undefined }}>
          {team.name}
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {players.map((p) => (
          <div key={p.id} className="rounded-xl bg-white px-4 py-3 font-medium text-stone-700 shadow-sm">
            {p.nickname}
          </div>
        ))}
      </div>
    </div>
  );
}

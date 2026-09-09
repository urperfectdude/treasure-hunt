import type { Team } from "../../lib/types";

export default function ProgressTab({ team, clueCount }: { team: Team; clueCount: number }) {
  const pct = Math.min(100, Math.round((team.completed_clues / clueCount) * 100));

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="text-center">
        <p className="text-5xl font-black text-stone-900">
          {team.completed_clues}
          <span className="text-2xl text-stone-400"> / {clueCount}</span>
        </p>
        <p className="mt-1 text-sm text-stone-500">clues completed</p>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-amber-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Hints used" value={team.hints_used} />
        <Stat label="Incorrect tries" value={team.failed_attempts} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-bold text-stone-800">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}

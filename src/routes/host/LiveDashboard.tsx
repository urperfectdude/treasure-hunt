import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loadHostSession } from "../../lib/session";
import { useHostSnapshot } from "../../hooks/useHostSnapshot";
import { api } from "../../lib/functions";
import Button from "../../components/Button";

export default function LiveDashboard() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const session = gameId ? loadHostSession(gameId) : null;
  const { snapshot, refetch } = useHostSnapshot(gameId ?? null, session?.hostToken ?? null);

  if (!gameId || !session) return null;
  if (!snapshot) return <div className="p-8 text-center text-stone-400">Loading dashboard…</div>;

  const { game, teams, clues, submissions } = snapshot;
  const pendingSubmissions = submissions.filter((s) => s.host_decision === "pending");

  async function control(action: string) {
    if (!session) return;
    await api.gameControl({ gameId: gameId!, hostToken: session.hostToken, action });
    refetch();
    if (action === "end") navigate(`/host/${gameId}/summary`);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold tracking-widest text-stone-400">
            {game.properties?.name ?? "TREASURE HUNT"}
          </p>
          <p className="font-bold text-stone-900">
            {game.status === "active" ? "🟢 LIVE" : game.status === "paused" ? "⏸️ PAUSED" : game.status.toUpperCase()}
          </p>
        </div>
        <div className="flex gap-2">
          {game.status === "active" ? (
            <Button variant="ghost" onClick={() => control("pause")} className="px-4 py-2 text-sm">
              Pause
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => control("resume")} className="px-4 py-2 text-sm">
              Resume
            </Button>
          )}
          <Button variant="danger" onClick={() => control("end")} className="px-4 py-2 text-sm">
            End Game
          </Button>
        </div>
      </header>

      <label className="flex items-center justify-between rounded-2xl bg-white p-4 text-sm font-medium shadow-sm">
        Show live leaderboard to players
        <input
          type="checkbox"
          checked={game.show_leaderboard}
          onChange={() => control("toggleLeaderboard")}
        />
      </label>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-600">TEAMS</h2>
        <div className="flex flex-col gap-2">
          {teams.map((team) => {
            const activeClue = clues.find((c) => c.team_id === team.id && c.status === "active");
            const teamPending = pendingSubmissions.some((s) => s.team_id === team.id);
            const statusLabel = team.completed_at
              ? team.winner
                ? "🏆 Finished (winner)"
                : "✅ Finished"
              : teamPending
                ? "🟡 Waiting for verification"
                : "🔵 Searching";

            return (
              <div key={team.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold" style={{ color: team.color ?? undefined }}>
                    {team.icon} {team.name}
                  </span>
                  <span className="text-sm text-stone-500">
                    {team.completed_clues} / {game.clue_count}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">{statusLabel}</p>
                {activeClue && (
                  <ClueControls gameId={gameId!} hostToken={session.hostToken} clue={activeClue} onChanged={refetch} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-600">
          INCOMING SUBMISSIONS {pendingSubmissions.length > 0 && `(${pendingSubmissions.length})`}
        </h2>
        <div className="flex flex-col gap-3">
          {pendingSubmissions.length === 0 && (
            <p className="text-sm text-stone-400">No submissions waiting.</p>
          )}
          {pendingSubmissions.map((s) => {
            const team = teams.find((t) => t.id === s.team_id);
            return (
              <SubmissionCard
                key={s.id}
                hostToken={session.hostToken}
                submission={s}
                teamName={team?.name ?? "Unknown team"}
                locationName={s.clues?.property_locations?.name ?? "Unknown"}
                onReviewed={refetch}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SubmissionCard({
  hostToken,
  submission,
  teamName,
  locationName,
  onReviewed,
}: {
  hostToken: string;
  submission: { id: string; photo_url: string; ai_visual_match: number | null; submitted_at: string };
  teamName: string;
  locationName: string;
  onReviewed: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  async function review(decision: "correct" | "incorrect") {
    setBusy(true);
    try {
      await api.reviewSubmission({
        submissionId: submission.id,
        decision,
        hostFeedback: feedback.trim() || undefined,
        hostToken,
      });
      onReviewed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-stone-800">{teamName}</span>
        <span className="text-stone-400">{new Date(submission.submitted_at).toLocaleTimeString()}</span>
      </div>
      <p className="mt-1 text-xs text-stone-500">Expected: {locationName}</p>
      {submission.ai_visual_match !== null && (
        <p className="text-xs text-stone-400">AI visual match: {Math.round(submission.ai_visual_match)}%</p>
      )}
      <img src={submission.photo_url} alt="Submission" className="mt-2 max-h-64 w-full rounded-xl object-cover" />
      <input
        className="mt-3 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
        placeholder="Optional feedback for the team…"
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <div className="mt-3 flex gap-2">
        <Button
          disabled={busy}
          onClick={() => review("correct")}
          className="flex-1 py-3 text-base"
        >
          ✓ CORRECT
        </Button>
        <Button
          disabled={busy}
          variant="danger"
          onClick={() => review("incorrect")}
          className="flex-1 py-3 text-base"
        >
          ✕ INCORRECT
        </Button>
      </div>
    </div>
  );
}

function ClueControls({
  hostToken,
  clue,
  onChanged,
}: {
  gameId: string;
  hostToken: string;
  clue: { id: string; clue_text: string };
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(
    action: "regenerate" | "easier" | "harder" | "custom",
    customInstruction?: string,
  ) {
    setBusy(true);
    try {
      await api.adjustClue({ clueId: clue.id, hostToken, action, customInstruction });
      onChanged();
      setCustom("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 border-t border-stone-100 pt-2">
      <button onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-amber-600">
        {open ? "Hide clue controls" : "Show current clue & controls"}
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="rounded-lg bg-stone-50 p-2 text-sm text-stone-600">{clue.clue_text}</p>
          <div className="flex flex-wrap gap-2">
            <SmallButton disabled={busy} onClick={() => act("regenerate")}>Regenerate</SmallButton>
            <SmallButton disabled={busy} onClick={() => act("easier")}>Easier</SmallButton>
            <SmallButton disabled={busy} onClick={() => act("harder")}>Harder</SmallButton>
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm"
              placeholder="Custom instruction…"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
            />
            <SmallButton disabled={busy || !custom.trim()} onClick={() => act("custom", custom)}>
              Apply
            </SmallButton>
          </div>
        </div>
      )}
    </div>
  );
}

function SmallButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-full border border-stone-300 px-3 py-1 text-xs font-semibold text-stone-600 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

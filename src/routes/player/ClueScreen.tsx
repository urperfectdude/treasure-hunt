import { useRef, useState } from "react";
import { useLatestSubmission } from "../../hooks/useGameData";
import { api } from "../../lib/functions";
import { uploadSubmissionPhoto } from "../../lib/storage";
import Button from "../../components/Button";
import type { PlayerClue, Team } from "../../lib/types";

interface Props {
  gameId: string;
  clue: PlayerClue;
  team: Team;
  playerId: string;
  clueCount: number;
  hintsAllowed: boolean;
}

export default function ClueScreen({ gameId, clue, team, playerId, clueCount, hintsAllowed }: Props) {
  const submission = useLatestSubmission(clue.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  const isPending = submission?.host_decision === "pending";
  const isCorrect = submission?.host_decision === "correct";
  const isIncorrect = submission?.host_decision === "incorrect";
  const isAdvancing = isCorrect && clue.status === "solved";

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const photoUrl = await uploadSubmissionPhoto(gameId, team.id, file);
      await api.submitPhoto({ clueId: clue.id, teamId: team.id, playerId, photoUrl });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed — try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleHint() {
    setHintRevealed(true);
    if (hintText) return;
    setHintLoading(true);
    try {
      const { hintText: text } = await api.generateHint({ clueId: clue.id, teamId: team.id });
      setHintText(text);
    } finally {
      setHintLoading(false);
    }
  }

  if (isAdvancing) {
    return (
      <Centered>
        <p className="text-6xl">🎉</p>
        <h2 className="mt-4 text-2xl font-bold">LOCATION FOUND!</h2>
        <p className="mt-2 text-stone-500">Your next challenge is being prepared…</p>
      </Centered>
    );
  }

  if (isPending) {
    return (
      <Centered>
        <p className="text-6xl">📸</p>
        <h2 className="mt-4 text-2xl font-bold">Submitted!</h2>
        <p className="mt-2 text-stone-500">
          The Game Master is checking your discovery. Stay there until you hear back.
        </p>
      </Centered>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="text-center">
        <p className="text-xs font-bold tracking-widest text-amber-600">
          CLUE #{clue.sequence}
        </p>
      </div>

      {isIncorrect && submission && (
        <div className="rounded-xl bg-red-50 p-4 text-center">
          <p className="font-semibold text-red-700">❌ Not quite. Try again.</p>
          {submission.host_feedback && (
            <p className="mt-1 text-sm text-red-600">
              Game Master says: “{submission.host_feedback}”
            </p>
          )}
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <p className="whitespace-pre-line text-xl leading-relaxed text-stone-800">
          {clue.clue_text}
        </p>
      </div>

      {hintsAllowed && (
        <div className="text-center">
          {!hintRevealed ? (
            <button
              onClick={handleHint}
              className="text-sm font-semibold text-amber-600 underline underline-offset-4"
            >
              💡 Need a hint?
            </button>
          ) : (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              {hintLoading ? "Thinking…" : hintText ?? "No hint available."}
            </p>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelected}
      />
      <Button disabled={uploading} onClick={() => fileInputRef.current?.click()}>
        {uploading ? "Uploading…" : "I'VE FOUND IT 📸"}
      </Button>
      {uploadError && <p className="text-center text-sm text-red-600">{uploadError}</p>}

      <p className="text-center text-sm font-medium text-stone-400">
        {clue.sequence} / {clueCount} CLUES
      </p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

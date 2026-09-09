import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts";
import { assertHostToken, supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { generateNextClueForTeam } from "../_shared/generateNextClue.ts";

// The host's verdict. On "correct", advances the team — solving the clue,
// bumping progress, and either generating the next clue or, if this was
// the final clue, locking in the win. On "incorrect", the current clue
// stays active; the team just sees the feedback and tries again. AI never
// makes this call itself — the host always does.
Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const { submissionId, decision, hostFeedback, hostToken } = await req.json();
    if (!submissionId || !["correct", "incorrect"].includes(decision)) {
      return errorResponse("submissionId and a valid decision are required");
    }

    const db = supabaseAdmin();

    const { data: submission, error: subError } = await db
      .from("submissions")
      .select("id, clue_id, team_id, host_decision")
      .eq("id", submissionId)
      .single();
    if (subError || !submission) return errorResponse("Submission not found", 404);
    if (submission.host_decision !== "pending") {
      return errorResponse("Submission has already been reviewed");
    }

    const { data: clue, error: clueError } = await db
      .from("clues")
      .select("id, game_id, team_id, sequence, is_final, status")
      .eq("id", submission.clue_id)
      .single();
    if (clueError || !clue) return errorResponse("Clue not found", 404);

    await assertHostToken(db, clue.game_id, hostToken);

    await db
      .from("submissions")
      .update({
        host_decision: decision,
        host_feedback: hostFeedback ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (decision === "incorrect") {
      const { data: team } = await db
        .from("teams")
        .select("failed_attempts")
        .eq("id", clue.team_id)
        .single();
      await db
        .from("teams")
        .update({ failed_attempts: (team?.failed_attempts ?? 0) + 1 })
        .eq("id", clue.team_id);

      await db.from("game_events").insert({
        game_id: clue.game_id,
        team_id: clue.team_id,
        type: "submission_rejected",
        payload: { submission_id: submissionId, clue_id: clue.id },
      });
      return jsonResponse({ decision: "incorrect" });
    }

    // Correct: mark the clue solved and advance the team.
    const solvedAt = new Date().toISOString();
    await db.from("clues").update({ status: "solved", solved_at: solvedAt }).eq("id", clue.id);
    await db
      .from("clue_player_state")
      .update({ status: "solved", solved_at: solvedAt })
      .eq("id", clue.id);

    const { data: team } = await db
      .from("teams")
      .select("completed_clues")
      .eq("id", clue.team_id)
      .single();
    const completedClues = (team?.completed_clues ?? 0) + 1;
    await db.from("teams").update({ completed_clues: completedClues }).eq("id", clue.team_id);

    await db.from("game_events").insert({
      game_id: clue.game_id,
      team_id: clue.team_id,
      type: "submission_approved",
      payload: { submission_id: submissionId, clue_id: clue.id },
    });

    if (clue.is_final) {
      const { data: existingWinner } = await db
        .from("teams")
        .select("id")
        .eq("game_id", clue.game_id)
        .eq("winner", true)
        .maybeSingle();

      await db
        .from("teams")
        .update({
          completed_at: new Date().toISOString(),
          winner: !existingWinner,
        })
        .eq("id", clue.team_id);

      await db.from("game_events").insert({
        game_id: clue.game_id,
        team_id: clue.team_id,
        type: "team_finished",
        payload: { won: !existingWinner },
      });

      // Finish the whole game once every team has completed. Host may
      // still end it early via a separate end-game action.
      const { data: allTeams } = await db
        .from("teams")
        .select("completed_at")
        .eq("game_id", clue.game_id);
      const allDone = (allTeams ?? []).every((t) => t.completed_at !== null);
      if (allDone) {
        await db
          .from("games")
          .update({ status: "finished", finished_at: new Date().toISOString() })
          .eq("id", clue.game_id);
      }

      return jsonResponse({ decision: "correct", finished: true, won: !existingWinner });
    }

    const nextClue = await generateNextClueForTeam(db, clue.game_id, clue.team_id);
    return jsonResponse({ decision: "correct", finished: false, nextClue });
  } catch (err) {
    console.error(err);
    return errorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

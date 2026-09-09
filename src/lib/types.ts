export type GameStatus = "lobby" | "active" | "paused" | "finished";
export type Difficulty = "easy" | "medium" | "hard" | "extreme";
export type ClueStatus = "active" | "solved";
export type HostDecision = "pending" | "correct" | "incorrect";

export interface Property {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

// Returned by list-properties for the "choose an existing property" picker.
export interface PropertySummary extends Property {
  safeLocationCount: number;
}

export interface Game {
  id: string;
  property_id: string;
  code: string;
  host_token: string;
  status: GameStatus;
  number_of_teams: number;
  difficulty: Difficulty;
  theme: string | null;
  clue_count: number;
  hints_allowed: boolean;
  final_location_id: string | null;
  show_leaderboard: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface Team {
  id: string;
  game_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  completed_clues: number;
  hints_used: number;
  failed_attempts: number;
  winner: boolean;
  started_at: string | null;
  completed_at: string | null;
}

export interface Player {
  id: string;
  team_id: string;
  nickname: string;
  joined_at: string;
}

export interface PropertyLocation {
  id: string;
  property_id: string;
  name: string;
  floor: string | null;
  area: string | null;
  host_description: string | null;
  ai_description: string | null;
  tags: string[];
  reference_image_url: string | null;
  safe_for_game: boolean;
  created_at: string;
}

// What players are allowed to see — never target_location_id or ai_reasoning.
export interface PlayerClue {
  id: string;
  game_id: string;
  team_id: string;
  sequence: number;
  clue_text: string;
  hint_text: string | null;
  status: ClueStatus;
  is_final: boolean;
  generated_at: string;
  solved_at: string | null;
}

// Host-only, includes target_location_id + ai_reasoning (via Edge Function).
export interface HostClue extends PlayerClue {
  target_location_id: string;
  difficulty: Difficulty;
  theme: string | null;
  ai_reasoning: string | null;
}

export interface Submission {
  id: string;
  game_id: string;
  clue_id: string;
  team_id: string;
  player_id: string | null;
  photo_url: string;
  submitted_at: string;
  ai_visual_match: number | null;
  host_decision: HostDecision;
  host_feedback: string | null;
  reviewed_at: string | null;
}

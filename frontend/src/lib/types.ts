export type ApiError = { error: string };

export type AuthUser = {
  id: string;
  username: string;
  email?: string;
  elo: number;
  metadata?: {
    avatar_url?: string;
    college?: string;
    bio?: string;
  };
  codeDna?: {
    weak_topics?: string[];
    patterns?: string[];
    ai_summary?: string;
  };
  createdAt?: string;
};

export type AuthResponse = {
  user: Pick<AuthUser, "id" | "username" | "elo">;
  token: string;
};

export type Room = {
  id: string;
  roomCode: string;
  hostId: string;
  guestId: string | null;
  status: "waiting" | "ready" | "active" | "done";
  options: RoomOptions;
  host?: { id: string; username: string; elo: number };
  guest?: { id: string; username: string; elo: number } | null;
};

export type RoomOptions = {
  time_limit_minutes?: number;
  difficulty?: "easy" | "medium" | "hard";
  topic?: string | null;
  spectators_allowed?: boolean;
  live_commentator?: boolean;
  blind_rating?: { enabled: boolean };
  dead_mans_switch?: { enabled: boolean; idle_seconds: number };
};

export type Problem = {
  id: string;
  title: string;
  slug: string;
  difficulty: "easy" | "medium" | "hard";
  topics: string[];
  description: string;
  constraints?: string | null;
  examples?: Array<{ input: string; output: string; explanation?: string }>;
  starterCode?: Record<string, string>;
  companyTags?: string[];
  editorial?: string | null;
};

export type Match = {
  id: string;
  roomId: string;
  problemId: string;
  player1Id: string;
  player2Id: string;
  winnerId: string | null;
  status: "active" | "finished" | "abandoned";
  startedAt: string;
  endedAt: string | null;
  metadata?: Record<string, unknown>;
};

export type Submission = {
  id: string;
  matchId: string;
  userId: string;
  code: string;
  language: string;
  verdict: string;
  runtimeMs: number | null;
  memoryKb?: number | null;
  testCasesPassed: number;
  testCasesTotal: number;
  complexity?: { time: string; space: string; ai_note?: string; explanation?: string } | null;
  isFinal?: boolean;
  submittedAt: string;
};

export type PlayerDebrief = {
  id: string;
  username: string;
  elo: number;
  score: number;
  solve_time_ms: number | null;
  elo_delta: number | null;
  old_elo?: number | null;
  new_elo?: number | null;
  submission_count: number;
  final_submission?: Submission | null;
};

export type DebriefResponse = {
  match: {
    id: string;
    status: "finished" | "abandoned" | "active";
    startedAt: string | null;
    endedAt: string | null;
    winner_id: string | null;
  };
  problem: {
    id: string;
    title: string;
    difficulty: "easy" | "medium" | "hard";
    topics: string[];
    editorial?: string | null;
  };
  player1: PlayerDebrief;
  player2: PlayerDebrief;
  events_timeline?: MatchEvent[];
};

export type MatchEvent = {
  id: string;
  matchId: string;
  userId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ComplexityResponse = { time: string; space: string; ai_note?: string; explanation: string };
export type RoastResponse = { roast: string };
export type AutopsyResponse = { autopsy: string };
export type ReviewResponse = {
  review: {
    grade: string;
    quality: string;
    efficiency: string;
    bugs: string;
    strengths: string;
  };
};
export type ApproachesResponse = {
  approaches: Array<{
    approach: string;
    explanation: string;
    time_complexity: string;
    space_complexity: string;
  }>;
};

// Rank tier system
export type RankTier = {
  name: string;
  color: string;
  icon: string;
  textColor: string;
  bgColor: string;
  glowColor: string;
};

export function getRankTier(elo: number): RankTier {
  if (elo >= 2000) return { name: 'Legend', color: 'from-yellow-400 to-red-500', icon: '♛', textColor: 'text-yellow-300', bgColor: 'bg-gradient-to-r from-yellow-900/30 to-red-900/30', glowColor: 'shadow-yellow-500/20' };
  if (elo >= 1800) return { name: 'Master', color: 'from-red-400 to-pink-500', icon: '♚', textColor: 'text-red-300', bgColor: 'bg-gradient-to-r from-red-900/30 to-pink-900/30', glowColor: 'shadow-red-500/20' };
  if (elo >= 1600) return { name: 'Diamond', color: 'from-cyan-300 to-blue-400', icon: '◆', textColor: 'text-cyan-300', bgColor: 'bg-gradient-to-r from-cyan-900/30 to-blue-900/30', glowColor: 'shadow-cyan-500/20' };
  if (elo >= 1400) return { name: 'Platinum', color: 'from-teal-300 to-cyan-400', icon: '▲', textColor: 'text-teal-300', bgColor: 'bg-gradient-to-r from-teal-900/30 to-cyan-900/30', glowColor: 'shadow-teal-500/20' };
  if (elo >= 1200) return { name: 'Gold', color: 'from-yellow-300 to-amber-400', icon: '★', textColor: 'text-yellow-300', bgColor: 'bg-gradient-to-r from-yellow-900/30 to-amber-900/30', glowColor: 'shadow-yellow-500/20' };
  if (elo >= 1000) return { name: 'Silver', color: 'from-gray-300 to-gray-400', icon: '●', textColor: 'text-gray-300', bgColor: 'bg-gradient-to-r from-gray-800/30 to-gray-700/30', glowColor: 'shadow-gray-500/20' };
  return { name: 'Bronze', color: 'from-orange-400 to-amber-600', icon: '■', textColor: 'text-orange-300', bgColor: 'bg-gradient-to-r from-orange-900/30 to-amber-900/30', glowColor: 'shadow-orange-500/20' };
}

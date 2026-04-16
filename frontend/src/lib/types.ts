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
  options: {
    time_limit_minutes?: number;
    difficulty?: "easy" | "medium" | "hard";
    topic?: string | null;
    spectators_allowed?: boolean;
    live_commentator?: boolean;
    blind_rating?: { enabled: boolean };
    dead_mans_switch?: { enabled: boolean; idle_seconds: number };
  };
  host?: { id: string; username: string; elo: number };
  guest?: { id: string; username: string; elo: number } | null;
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
};

export type Submission = {
  id: string;
  matchId: string;
  userId: string;
  language: string;
  verdict: string;
  runtimeMs: number | null;
  testCasesPassed: number;
  testCasesTotal: number;
  submittedAt: string;
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
  player1: {
    id: string;
    username: string;
    elo: number;
    score: number;
    solve_time_ms: number | null;
    elo_delta: number | null;
    submission_count: number;
  };
  player2: {
    id: string;
    username: string;
    elo: number;
    score: number;
    solve_time_ms: number | null;
    elo_delta: number | null;
    submission_count: number;
  };
};

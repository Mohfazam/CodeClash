import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  text,
  timestamp,
  jsonb,
  index,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roomStatusEnum = pgEnum("room_status", [
  "waiting",
  "ready",
  "active",
  "done",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "active",
  "finished",
  "abandoned",
]);

export const verdictEnum = pgEnum("verdict", [
  "accepted",
  "wrong_answer",
  "time_limit_exceeded",
  "runtime_error",
  "compilation_error",
  "pending",
]);

export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);

// ─── users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  elo: integer("elo").default(1200).notNull(),
  // { "weak_topics": ["dp","graphs"], "patterns": ["brute_force_first"], "ai_summary": "..." }
  codeDna: jsonb("code_dna").default({}).$type<{
    weak_topics?: string[];
    patterns?: string[];
    ai_summary?: string;
  }>(),
  // { "avatar_url": "", "college": "", "bio": "" }
  metadata: jsonb("metadata").default({}).$type<{
    avatar_url?: string;
    college?: string;
    bio?: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── rooms ────────────────────────────────────────────────────────────────────

export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  // 6 uppercase alphanumeric, no 0/O/1/I  e.g. "AH3K7P"
  roomCode: varchar("room_code", { length: 6 }).unique().notNull(),
  hostId: uuid("host_id")
    .references(() => users.id)
    .notNull(),
  guestId: uuid("guest_id").references(() => users.id),
  status: roomStatusEnum("status").default("waiting").notNull(),
  /*
    {
      "dead_mans_switch": { "enabled": false, "idle_seconds": 45 },
      "blind_rating":     { "enabled": false },
      "live_commentator": true,
      "spectators_allowed": true,
      "time_limit_minutes": 30,
      "difficulty": "medium",
      "topic": null
    }
  */
  options: jsonb("options")
    .default({
      dead_mans_switch: { enabled: false, idle_seconds: 45 },
      blind_rating: { enabled: false },
      wager: { enabled: false, amount: 0 },
      live_commentator: true,
      spectators_allowed: true,
      time_limit_minutes: 30,
      difficulty: "medium",
      topic: null,
    })
    .$type<{
      dead_mans_switch?: { enabled: boolean; idle_seconds: number };
      blind_rating?: { enabled: boolean };
      wager?: { enabled: boolean; amount: number };
      live_commentator?: boolean;
      spectators_allowed?: boolean;
      time_limit_minutes?: number;
      difficulty?: "easy" | "medium" | "hard";
      topic?: string | null;
    }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── problems ─────────────────────────────────────────────────────────────────

export const problems = pgTable("problems", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).unique().notNull(),
  difficulty: difficultyEnum("difficulty").notNull(),
  // ['arrays','strings','trees','graphs','dp','sorting','hashing','recursion']
  topics: text("topics").array().default([]).notNull(),
  companyTags: text("company_tags").array().default([]).notNull(),
  description: text("description").notNull(),
  // [{ "input": "nums=[2,7]", "output": "[0,1]", "explanation": "..." }]
  examples: jsonb("examples").default([]).$type<
    Array<{ input: string; output: string; explanation?: string }>
  >(),
  constraints: text("constraints"),
  // [{ "input": "...", "expected_output": "...", "is_hidden": true }]
  testCases: jsonb("test_cases").default([]).$type<
    Array<{ input: string; expected_output: string; is_hidden: boolean }>
  >(),
  // { "javascript": "function ...", "python": "def ...", "cpp": "..." }
  starterCode: jsonb("starter_code").default({}).$type<{
    javascript?: string;
    python?: string;
    cpp?: string;
    java?: string;
  }>(),
  editorial: text("editorial"),
  metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── matches ──────────────────────────────────────────────────────────────────

export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id")
    .references(() => rooms.id)
    .notNull(),
  problemId: uuid("problem_id")
    .references(() => problems.id)
    .notNull(),
  player1Id: uuid("player1_id")
    .references(() => users.id)
    .notNull(),
  player2Id: uuid("player2_id")
    .references(() => users.id)
    .notNull(),
  // NULL = draw or abandoned
  winnerId: uuid("winner_id").references(() => users.id),
  status: matchStatusEnum("status").default("active").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  // { "spectator_count": 0, "final_scores": { "p1": 85, "p2": 60 } }
  metadata: jsonb("metadata").default({}).$type<{
    spectator_count?: number;
    final_scores?: { p1: number; p2: number };
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── submissions ──────────────────────────────────────────────────────────────

export const submissions = pgTable("submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchId: uuid("match_id")
    .references(() => matches.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  code: text("code").notNull(),
  // 'javascript' | 'python' | 'cpp' | 'java'
  language: varchar("language", { length: 30 }).notNull(),
  verdict: verdictEnum("verdict").default("pending").notNull(),
  runtimeMs: integer("runtime_ms"),
  memoryKb: integer("memory_kb"),
  testCasesPassed: integer("test_cases_passed").default(0).notNull(),
  testCasesTotal: integer("test_cases_total").default(0).notNull(),
  // { "time": "O(n log n)", "space": "O(n)", "ai_note": "..." }
  complexity: jsonb("complexity").default({}).$type<{
    time?: string;
    space?: string;
    ai_note?: string;
    explanation?: string;
  }>(),
  // TRUE = this was the winning/last submission
  isFinal: boolean("is_final").default(false).notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── match_events ─────────────────────────────────────────────────────────────
// Append-only event log — powers AI commentator, autopsy, dead man's switch, code DNA

export const matchEvents = pgTable(
  "match_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .references(() => matches.id)
      .notNull(),
    // NULL = system event
    userId: uuid("user_id").references(() => users.id),
    /*
      event_type values:
      'match_start' | 'code_change' | 'run_code' | 'submission' |
      'test_passed' | 'test_failed' | 'wrong_answer' | 'accepted' |
      'idle_warning' | 'lines_deleted' | 'surrender' |
      'match_end' | 'ai_comment' | 'spectator_joined'
    */
    eventType: varchar("event_type", { length: 50 }).notNull(),
    payload: jsonb("payload").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Fast event timeline queries per match
    index("idx_match_events_match_id").on(table.matchId, table.createdAt),
  ]
);

// ─── elo_history ──────────────────────────────────────────────────────────────
// Append-only — never update. Current ELO lives on users.elo

export const eloHistory = pgTable("elo_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  matchId: uuid("match_id")
    .references(() => matches.id)
    .notNull(),
  opponentId: uuid("opponent_id").references(() => users.id),
  oldElo: integer("old_elo").notNull(),
  newElo: integer("new_elo").notNull(),
  // positive = won, negative = lost
  delta: integer("delta").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── topic_stats ──────────────────────────────────────────────────────────────
// Upserted after every match. Powers profile card heatmap.

export const topicStats = pgTable(
  "topic_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    topic: varchar("topic", { length: 50 }).notNull(),
    wins: integer("wins").default(0).notNull(),
    losses: integer("losses").default(0).notNull(),
    avgSolveTimeMs: integer("avg_solve_time_ms"),
    // ["W","L","W","W","L"]
    last5Outcomes: jsonb("last_5_outcomes").default([]).$type<Array<"W" | "L">>(),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("topic_stats_user_topic_unique").on(table.userId, table.topic)]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  hostedRooms: many(rooms, { relationName: "host" }),
  guestRooms: many(rooms, { relationName: "guest" }),
  player1Matches: many(matches, { relationName: "player1" }),
  player2Matches: many(matches, { relationName: "player2" }),
  submissions: many(submissions),
  matchEvents: many(matchEvents),
  eloHistory: many(eloHistory),
  topicStats: many(topicStats),
}));

export const roomsRelations = relations(rooms, ({ one, many }) => ({
  host: one(users, { fields: [rooms.hostId], references: [users.id], relationName: "host" }),
  guest: one(users, { fields: [rooms.guestId], references: [users.id], relationName: "guest" }),
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  room: one(rooms, { fields: [matches.roomId], references: [rooms.id] }),
  problem: one(problems, { fields: [matches.problemId], references: [problems.id] }),
  player1: one(users, { fields: [matches.player1Id], references: [users.id], relationName: "player1" }),
  player2: one(users, { fields: [matches.player2Id], references: [users.id], relationName: "player2" }),
  winner: one(users, { fields: [matches.winnerId], references: [users.id], relationName: "winner" }),
  submissions: many(submissions),
  events: many(matchEvents),
  eloHistory: many(eloHistory),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  match: one(matches, { fields: [submissions.matchId], references: [matches.id] }),
  user: one(users, { fields: [submissions.userId], references: [users.id] }),
}));

export const matchEventsRelations = relations(matchEvents, ({ one }) => ({
  match: one(matches, { fields: [matchEvents.matchId], references: [matches.id] }),
  user: one(users, { fields: [matchEvents.userId], references: [users.id] }),
}));

export const eloHistoryRelations = relations(eloHistory, ({ one }) => ({
  user: one(users, { fields: [eloHistory.userId], references: [users.id] }),
  match: one(matches, { fields: [eloHistory.matchId], references: [matches.id] }),
  opponent: one(users, { fields: [eloHistory.opponentId], references: [users.id], relationName: "opponent" }),
}));

export const topicStatsRelations = relations(topicStats, ({ one }) => ({
  user: one(users, { fields: [topicStats.userId], references: [users.id] }),
}));

// ─── Type Exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;
export type Problem = typeof problems.$inferSelect;
export type NewProblem = typeof problems.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Submission = typeof submissions.$inferSelect;
export type NewSubmission = typeof submissions.$inferInsert;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type NewMatchEvent = typeof matchEvents.$inferInsert;
export type EloHistory = typeof eloHistory.$inferSelect;
export type NewEloHistory = typeof eloHistory.$inferInsert;
export type TopicStat = typeof topicStats.$inferSelect;
export type NewTopicStat = typeof topicStats.$inferInsert;
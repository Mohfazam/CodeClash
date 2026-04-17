import { Router, Request, Response } from "express";
import { eq, or, desc } from "drizzle-orm";
import { db } from "../db";
import { matches, rooms, problems, users, submissions, eloHistory, matchEvents } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

// ELO calculation (standard formula, K=32)
function calculateElo(winnerElo: number, loserElo: number, kFactor = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;
  const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
  const loserDelta = Math.round(kFactor * (0 - expectedLoser));
  return { winnerDelta, loserDelta };
}

// GET /api/matches/history — current user's match history
router.get("/history", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { limit = "20", offset = "0" } = req.query;

    const history = await db
      .select()
      .from(matches)
      .where(or(eq(matches.player1Id, userId), eq(matches.player2Id, userId)))
      .orderBy(desc(matches.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const enriched = await Promise.all(
      history.map(async (m) => {
        const opponentId = m.player1Id === userId ? m.player2Id : m.player1Id;

        const [problem] = await db
          .select({ title: problems.title, slug: problems.slug, difficulty: problems.difficulty })
          .from(problems)
          .where(eq(problems.id, m.problemId))
          .limit(1);

        const [opponent] = await db
          .select({ username: users.username, elo: users.elo })
          .from(users)
          .where(eq(users.id, opponentId))
          .limit(1);

        const [eloEntry] = await db
          .select({ delta: eloHistory.delta, oldElo: eloHistory.oldElo, newElo: eloHistory.newElo })
          .from(eloHistory)
          .where(eq(eloHistory.matchId, m.id))
          .limit(1);

        return {
          ...m,
          problem,
          opponent,
          eloDelta: eloEntry?.delta ?? null,
          result: m.winnerId === userId ? "win" : m.winnerId ? "loss" : "draw",
        };
      })
    );

    res.json({ matches: enriched, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    console.error("[GET /matches/history]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/matches/:id
router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, req.params.id as string))
      .limit(1);

    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    const [problem] = await db.select().from(problems).where(eq(problems.id, match.problemId)).limit(1);

    const [p1] = await db
      .select({ id: users.id, username: users.username, elo: users.elo })
      .from(users)
      .where(eq(users.id, match.player1Id))
      .limit(1);

    const [p2] = await db
      .select({ id: users.id, username: users.username, elo: users.elo })
      .from(users)
      .where(eq(users.id, match.player2Id))
      .limit(1);

    // Fetch room options for time limit
    const [room] = await db
      .select({ options: rooms.options })
      .from(rooms)
      .where(eq(rooms.id, match.roomId))
      .limit(1);

    res.json({
      ...match,
      problem: { ...problem, testCases: problem?.testCases?.filter((tc) => !tc.is_hidden) },
      player1: p1,
      player2: p2,
      roomOptions: room?.options ?? {},
    });
  } catch (err) {
    console.error("[GET /matches/:id]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/matches/:id/events — event timeline
router.get("/:id/events", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const events = await db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, req.params.id as string))
      .orderBy(matchEvents.createdAt);

    res.json(events);
  } catch (err) {
    console.error("[GET /matches/:id/events]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/matches/:id/debrief — post-match side-by-side summary
router.get("/:id/debrief", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const matchId = req.params.id as string;

    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    if (match.status === "active") {
      res.status(409).json({ error: "Match is still in progress" });
      return;
    }

    // Fetch both players
    const [p1] = await db
      .select({ id: users.id, username: users.username, elo: users.elo })
      .from(users)
      .where(eq(users.id, match.player1Id))
      .limit(1);

    const [p2] = await db
      .select({ id: users.id, username: users.username, elo: users.elo })
      .from(users)
      .where(eq(users.id, match.player2Id))
      .limit(1);

    // Fetch problem
    const [problem] = await db
      .select({ id: problems.id, title: problems.title, difficulty: problems.difficulty, topics: problems.topics, editorial: problems.editorial })
      .from(problems)
      .where(eq(problems.id, match.problemId))
      .limit(1);

    // Fetch all submissions for this match
    const allSubs = await db
      .select()
      .from(submissions)
      .where(eq(submissions.matchId, matchId))
      .orderBy(submissions.submittedAt);

    const p1Subs = allSubs.filter((s) => s.userId === match.player1Id);
    const p2Subs = allSubs.filter((s) => s.userId === match.player2Id);

    const p1Final = p1Subs.find((s) => s.isFinal) ?? p1Subs[p1Subs.length - 1] ?? null;
    const p2Final = p2Subs.find((s) => s.isFinal) ?? p2Subs[p2Subs.length - 1] ?? null;

    // Calculate solve times from match start
    const startedAt = match.startedAt ? new Date(match.startedAt).getTime() : null;

    const p1SolveTimeMs =
      p1Final && startedAt ? new Date(p1Final.submittedAt).getTime() - startedAt : null;
    const p2SolveTimeMs =
      p2Final && startedAt ? new Date(p2Final.submittedAt).getTime() - startedAt : null;

    // ELO deltas for both players
    const eloEntries = await db
      .select()
      .from(eloHistory)
      .where(eq(eloHistory.matchId, matchId));

    const p1Elo = eloEntries.find((e) => e.userId === match.player1Id);
    const p2Elo = eloEntries.find((e) => e.userId === match.player2Id);

    // Event timeline (non-hidden)
    const timeline = await db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(matchEvents.createdAt);

    // Scoring per doc formula
    function calcScore(sub: typeof p1Final, solveTimeMs: number | null, timeLimitMs: number) {
      if (!sub) return 0;
      const correctness = ((sub.testCasesPassed ?? 0) / Math.max(sub.testCasesTotal ?? 1, 1)) * 60;
      const speed = solveTimeMs ? Math.max(0, (1 - solveTimeMs / timeLimitMs) * 25) : 0;
      const complexityMap: Record<string, number> = {
        "O(n)": 15, "O(n log n)": 12, "O(n²)": 6, "O(n^2)": 6, "O(n³)": 2, "O(n^3)": 2,
      };
      const efficiencyScore = complexityMap[(sub.complexity as any)?.time ?? ""] ?? 0;
      return Math.round(correctness + speed + efficiencyScore);
    }

    const room = await db.select({ options: rooms.options }).from(rooms).where(eq(rooms.id, match.roomId)).limit(1);
    const timeLimitMs = ((room[0]?.options as any)?.time_limit_minutes ?? 30) * 60 * 1000;

    const p1Score = calcScore(p1Final, p1SolveTimeMs, timeLimitMs);
    const p2Score = calcScore(p2Final, p2SolveTimeMs, timeLimitMs);

    res.json({
      match: {
        id: match.id,
        status: match.status,
        startedAt: match.startedAt,
        endedAt: match.endedAt,
        winner_id: match.winnerId,
      },
      problem,
      player1: {
        ...p1,
        final_submission: p1Final,
        solve_time_ms: p1SolveTimeMs,
        score: p1Score,
        elo_delta: p1Elo?.delta ?? null,
        old_elo: p1Elo?.oldElo ?? null,
        new_elo: p1Elo?.newElo ?? null,
        submission_count: p1Subs.length,
      },
      player2: {
        ...p2,
        final_submission: p2Final,
        solve_time_ms: p2SolveTimeMs,
        score: p2Score,
        elo_delta: p2Elo?.delta ?? null,
        old_elo: p2Elo?.oldElo ?? null,
        new_elo: p2Elo?.newElo ?? null,
        submission_count: p2Subs.length,
      },
      events_timeline: timeline,
    });
  } catch (err) {
    console.error("[GET /matches/:id/debrief]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/matches/:id/surrender
router.post("/:id/surrender", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, req.params.id as string))
      .limit(1);

    if (!match) { res.status(404).json({ error: "Match not found" }); return; }
    if (match.status !== "active") { res.status(409).json({ error: "Match is already over" }); return; }

    const userId = req.user!.id;
    if (match.player1Id !== userId && match.player2Id !== userId) {
      res.status(403).json({ error: "You are not a player in this match" });
      return;
    }

    const winnerId = match.player1Id === userId ? match.player2Id : match.player1Id;

    await db.update(matches)
      .set({ status: "finished", winnerId, endedAt: new Date() })
      .where(eq(matches.id, match.id));

    // Update ELO
    const [winner] = await db.select({ elo: users.elo }).from(users).where(eq(users.id, winnerId)).limit(1);
    const [loser] = await db.select({ elo: users.elo }).from(users).where(eq(users.id, userId)).limit(1);

    let eloDelta = { winnerDelta: 0, loserDelta: 0 };

    if (winner && loser) {
      eloDelta = calculateElo(winner.elo, loser.elo);
      await db.update(users).set({ elo: winner.elo + eloDelta.winnerDelta }).where(eq(users.id, winnerId));
      await db.update(users).set({ elo: loser.elo + eloDelta.loserDelta }).where(eq(users.id, userId));

      await db.insert(eloHistory).values([
        { userId: winnerId, matchId: match.id, opponentId: userId, oldElo: winner.elo, newElo: winner.elo + eloDelta.winnerDelta, delta: eloDelta.winnerDelta },
        { userId, matchId: match.id, opponentId: winnerId, oldElo: loser.elo, newElo: loser.elo + eloDelta.loserDelta, delta: eloDelta.loserDelta },
      ]);
    }

    await db.insert(matchEvents).values({
      matchId: match.id,
      userId,
      eventType: "surrender",
      payload: { surrendered_by: userId },
    });

    await db.update(rooms).set({ status: "done", updatedAt: new Date() }).where(eq(rooms.id, match.roomId));

    // Broadcast via socket
    const { broadcastMatchEnded } = await import("../index");
    broadcastMatchEnded(match.id, {
      winner_id: winnerId,
      reason: "surrender",
      elo_deltas: { [winnerId]: eloDelta.winnerDelta, [userId]: eloDelta.loserDelta },
    });

    res.json({ message: "Surrendered", winnerId, eloDelta });
  } catch (err) {
    console.error("[POST /matches/:id/surrender]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
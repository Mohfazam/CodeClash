import { Router, Request, Response } from "express";
import { eq, or, desc } from "drizzle-orm";
import { db } from "../db";
import { matches, rooms, problems, users, submissions, eloHistory, matchEvents } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

// ELO calculation (standard formula)
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

    // Enrich with problem titles and opponent names
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

    const [problem] = await db
      .select()
      .from(problems)
      .where(eq(problems.id, match.problemId))
      .limit(1);

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

    res.json({
      ...match,
      problem: { ...problem, testCases: problem?.testCases?.filter((tc) => !tc.is_hidden) },
      player1: p1,
      player2: p2,
    });
  } catch (err) {
    console.error("[GET /matches/:id]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/matches/:id/events — event log for the match
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

// POST /api/matches/:id/surrender
router.post("/:id/surrender", requireAuth, async (req: Request, res: Response): Promise<void> => {
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
    if (match.status !== "active") {
      res.status(409).json({ error: "Match is already over" });
      return;
    }

    const userId = req.user!.id;
    if (match.player1Id !== userId && match.player2Id !== userId) {
      res.status(403).json({ error: "You are not a player in this match" });
      return;
    }

    const winnerId = match.player1Id === userId ? match.player2Id : match.player1Id;

    await db
      .update(matches)
      .set({ status: "finished", winnerId, endedAt: new Date() })
      .where(eq(matches.id, match.id));

    // Update ELO
    const [winner] = await db.select({ elo: users.elo }).from(users).where(eq(users.id, winnerId)).limit(1);
    const [loser] = await db.select({ elo: users.elo }).from(users).where(eq(users.id, userId)).limit(1);

    if (winner && loser) {
      const { winnerDelta, loserDelta } = calculateElo(winner.elo, loser.elo);

      await db.update(users).set({ elo: winner.elo + winnerDelta }).where(eq(users.id, winnerId));
      await db.update(users).set({ elo: loser.elo + loserDelta }).where(eq(users.id, userId));

      await db.insert(eloHistory).values([
        { userId: winnerId, matchId: match.id, opponentId: userId, oldElo: winner.elo, newElo: winner.elo + winnerDelta, delta: winnerDelta },
        { userId, matchId: match.id, opponentId: winnerId, oldElo: loser.elo, newElo: loser.elo + loserDelta, delta: loserDelta },
      ]);
    }

    // Log event
    await db.insert(matchEvents).values({
      matchId: match.id,
      userId,
      eventType: "surrender",
      payload: { surrendered_by: userId },
    });

    // Update room
    await db
      .update(rooms)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(rooms.id, match.roomId));

    res.json({ message: "Surrendered", winnerId });
  } catch (err) {
    console.error("[POST /matches/:id/surrender]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
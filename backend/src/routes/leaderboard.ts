import { Router, Request, Response } from "express";
import { desc, eq, or } from "drizzle-orm";
import { db } from "../db";
import { users, matches } from "../db/schema";

const router = Router();

// GET /api/leaderboard?limit=50&offset=0
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = "50", offset = "0" } = req.query;

    const top = await db
      .select({
        id: users.id,
        username: users.username,
        elo: users.elo,
        metadata: users.metadata,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.elo))
      .limit(Number(limit))
      .offset(Number(offset));

    // Calculate wins/losses for each player
    const rankedWithStats = await Promise.all(
      top.map(async (u, i) => {
        const wins = await db
          .select()
          .from(matches)
          .where(eq(matches.winnerId, u.id));
        
        const losses = await db
          .select()
          .from(matches)
          .where(or(
            eq(matches.player1Id, u.id),
            eq(matches.player2Id, u.id)
          ))
          .then(all => all.filter(m => m.winnerId && m.winnerId !== u.id && m.status === "finished"));
        
        return {
          rank: Number(offset) + i + 1,
          ...u,
          wins: wins.length,
          losses: losses.length,
          totalMatches: wins.length + losses.length,
        };
      })
    );

    res.json({ leaderboard: rankedWithStats, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    console.error("[GET /leaderboard]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
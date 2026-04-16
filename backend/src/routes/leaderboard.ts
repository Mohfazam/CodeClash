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

    // Add rank
    const ranked = top.map((u, i) => ({
      rank: Number(offset) + i + 1,
      ...u,
    }));

    res.json({ leaderboard: ranked, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    console.error("[GET /leaderboard]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
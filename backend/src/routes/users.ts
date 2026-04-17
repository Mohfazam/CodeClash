import { Router, Request, Response } from "express";
import { eq, desc, or } from "drizzle-orm";
import { db } from "../db";
import { users, matches, eloHistory, topicStats, submissions } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const updateProfileSchema = z.object({
  bio: z.string().max(300).optional(),
  college: z.string().max(100).optional(),
  avatar_url: z.string().url().optional().or(z.literal("")),
});

// GET /api/users/me/stats — detailed stats for logged-in user
router.get("/me/stats", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const [user] = await db
      .select({ id: users.id, username: users.username, elo: users.elo, codeDna: users.codeDna, metadata: users.metadata, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Topic stats (heatmap data)
    const stats = await db.select().from(topicStats).where(eq(topicStats.userId, userId));

    // ELO history (last 20)
    const elo = await db
      .select()
      .from(eloHistory)
      .where(eq(eloHistory.userId, userId))
      .orderBy(desc(eloHistory.createdAt))
      .limit(20);

    // Win/loss counts
    const allMatches = await db
      .select({ winnerId: matches.winnerId, player1Id: matches.player1Id, player2Id: matches.player2Id, status: matches.status })
      .from(matches)
      .where(eq(matches.player1Id, userId));

    const allMatches2 = await db
      .select({ winnerId: matches.winnerId, player1Id: matches.player1Id, player2Id: matches.player2Id, status: matches.status })
      .from(matches)
      .where(eq(matches.player2Id, userId));

    const allUserMatches = [...allMatches, ...allMatches2].filter((m) => m.status === "finished");
    const wins = allUserMatches.filter((m) => m.winnerId === userId).length;
    const losses = allUserMatches.filter((m) => m.winnerId && m.winnerId !== userId).length;

    res.json({ ...user, wins, losses, totalMatches: allUserMatches.length, topicStats: stats, eloHistory: elo });
  } catch (err) {
    console.error("[GET /users/me/stats]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/users/me — update profile
router.patch("/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const newMetadata = { ...(user.metadata ?? {}), ...parsed.data };

    const [updated] = await db
      .update(users)
      .set({ metadata: newMetadata, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id))
      .returning({ id: users.id, username: users.username, elo: users.elo, metadata: users.metadata });

    res.json(updated);
  } catch (err) {
    console.error("[PATCH /users/me]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:username/stats — public stats for any user
router.get("/:username/stats", async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({ id: users.id, username: users.username, elo: users.elo, codeDna: users.codeDna, metadata: users.metadata, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.username, req.params.username as string))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const userId = user.id;

    // Topic stats
    const stats = await db.select().from(topicStats).where(eq(topicStats.userId, userId));

    // ELO history (last 20)
    const elo = await db
      .select()
      .from(eloHistory)
      .where(eq(eloHistory.userId, userId))
      .orderBy(desc(eloHistory.createdAt))
      .limit(20);

    // Win/loss counts
    const allMatches1 = await db
      .select({ winnerId: matches.winnerId, status: matches.status })
      .from(matches)
      .where(eq(matches.player1Id, userId));

    const allMatches2 = await db
      .select({ winnerId: matches.winnerId, status: matches.status })
      .from(matches)
      .where(eq(matches.player2Id, userId));

    const allUserMatches = [...allMatches1, ...allMatches2].filter((m) => m.status === "finished");
    const wins = allUserMatches.filter((m) => m.winnerId === userId).length;
    const losses = allUserMatches.filter((m) => m.winnerId && m.winnerId !== userId).length;

    res.json({
      ...user,
      wins,
      losses,
      totalMatches: allUserMatches.length,
      topicStats: stats,
      eloHistory: elo,
    });
  } catch (err) {
    console.error("[GET /users/:username/stats]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/users/:username — public profile
router.get("/:username", async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({ id: users.id, username: users.username, elo: users.elo, metadata: users.metadata, codeDna: users.codeDna, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.username, req.params.username as string))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const stats = await db.select().from(topicStats).where(eq(topicStats.userId, user.id));

    res.json({ ...user, topicStats: stats });
  } catch (err) {
    console.error("[GET /users/:username]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
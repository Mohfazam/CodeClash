import { Router, Request, Response } from "express";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { problems } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

// GET /api/problems?difficulty=easy&topic=arrays&limit=20&offset=0
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { difficulty, topic, limit = "20", offset = "0" } = req.query;

    const all = await db.select().from(problems);

    let filtered = all;

    if (difficulty) {
      filtered = filtered.filter((p) => p.difficulty === difficulty);
    }

    if (topic && typeof topic === "string") {
      filtered = filtered.filter((p) => p.topics.includes(topic));
    }

    const total = filtered.length;
    const page = filtered.slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      problems: page.map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        difficulty: p.difficulty,
        topics: p.topics,
        companyTags: p.companyTags,
      })),
      total,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (err) {
    console.error("[GET /problems]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/problems/random?difficulty=medium&topic=arrays
router.get("/random", async (req: Request, res: Response): Promise<void> => {
  try {
    const { difficulty, topic } = req.query;

    const all = await db.select().from(problems);
    let pool = all;

    if (difficulty) pool = pool.filter((p) => p.difficulty === difficulty);
    if (topic && typeof topic === "string")
      pool = pool.filter((p) => p.topics.includes(topic));

    if (pool.length === 0) {
      res.status(404).json({ error: "No problems found matching criteria" });
      return;
    }

    const picked = pool[Math.floor(Math.random() * pool.length)];

    // Strip hidden test cases for players
    const sanitized = {
      ...picked,
      testCases: picked.testCases?.filter((tc) => !tc.is_hidden) ?? [],
    };

    res.json(sanitized);
  } catch (err) {
    console.error("[GET /problems/random]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/problems/:slug
router.get("/:slug", async (req: Request, res: Response): Promise<void> => {
  try {
    const [problem] = await db
      .select()
      .from(problems)
      .where(eq(problems.slug, req.params.slug as string))
      .limit(1);

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    // Strip hidden test cases
    const sanitized = {
      ...problem,
      testCases: problem.testCases?.filter((tc) => !tc.is_hidden) ?? [],
    };

    res.json(sanitized);
  } catch (err) {
    console.error("[GET /problems/:slug]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
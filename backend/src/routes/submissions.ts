import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { submissions, matches, problems, users, eloHistory, matchEvents, rooms } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const submitSchema = z.object({
  matchId: z.string().uuid(),
  code: z.string().min(1),
  language: z.enum(["javascript", "python", "cpp", "java"]),
});

function calculateElo(winnerElo: number, loserElo: number, kFactor = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
  const loserDelta = Math.round(kFactor * (0 - (1 - expectedWinner)));
  return { winnerDelta, loserDelta };
}

// NOTE: In a real judge you'd call Judge0 / Piston API here.
// This stub runs test cases in-process for JS only and mocks others.
async function judgeCode(
  code: string,
  language: string,
  testCases: Array<{ input: string; expected_output: string; is_hidden: boolean }>
): Promise<{
  verdict: "accepted" | "wrong_answer" | "runtime_error" | "compilation_error" | "time_limit_exceeded";
  runtimeMs: number;
  testCasesPassed: number;
  testCasesTotal: number;
}> {
  const total = testCases.length;

  // For hackathon purposes: accept all JS submissions that compile
  // REPLACE THIS with Judge0/Piston integration for production
  if (language !== "javascript") {
    // Simulate a 50/50 for demo
    const passed = Math.floor(Math.random() * (total + 1));
    return {
      verdict: passed === total ? "accepted" : "wrong_answer",
      runtimeMs: Math.floor(Math.random() * 200) + 50,
      testCasesPassed: passed,
      testCasesTotal: total,
    };
  }

  let passed = 0;
  const start = Date.now();

  for (const tc of testCases) {
    try {
      // Stub: wrap code + call with input. You should replace this.
      // eslint-disable-next-line no-new-func
      const fn = new Function("input", `${code}\n return typeof solution !== 'undefined' ? solution(input) : null;`);
      const result = fn(tc.input);
      if (String(result).trim() === tc.expected_output.trim()) passed++;
    } catch {
      return {
        verdict: "runtime_error",
        runtimeMs: Date.now() - start,
        testCasesPassed: passed,
        testCasesTotal: total,
      };
    }
  }

  return {
    verdict: passed === total ? "accepted" : "wrong_answer",
    runtimeMs: Date.now() - start,
    testCasesPassed: passed,
    testCasesTotal: total,
  };
}

// POST /api/submissions
router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { matchId, code, language } = parsed.data;
  const userId = req.user!.id;

  try {
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);

    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (match.status !== "active") {
      res.status(409).json({ error: "Match is already over" });
      return;
    }
    if (match.player1Id !== userId && match.player2Id !== userId) {
      res.status(403).json({ error: "You are not a player in this match" });
      return;
    }

    const [problem] = await db.select().from(problems).where(eq(problems.id, match.problemId)).limit(1);

    // Run judge
    const judgeResult = await judgeCode(code, language, problem.testCases ?? []);

    // Insert submission
    const [submission] = await db
      .insert(submissions)
      .values({
        matchId,
        userId,
        code,
        language,
        verdict: judgeResult.verdict,
        runtimeMs: judgeResult.runtimeMs,
        testCasesPassed: judgeResult.testCasesPassed,
        testCasesTotal: judgeResult.testCasesTotal,
        isFinal: judgeResult.verdict === "accepted",
      })
      .returning();

    // Log submission event
    await db.insert(matchEvents).values({
      matchId,
      userId,
      eventType: judgeResult.verdict === "accepted" ? "accepted" : "wrong_answer",
      payload: {
        submission_id: submission.id,
        verdict: judgeResult.verdict,
        runtime_ms: judgeResult.runtimeMs,
        tests_passed: judgeResult.testCasesPassed,
        tests_total: judgeResult.testCasesTotal,
      },
    });

    // If accepted — end match, update ELO
    if (judgeResult.verdict === "accepted") {
      const loserId = match.player1Id === userId ? match.player2Id : match.player1Id;

      await db
        .update(matches)
        .set({ status: "finished", winnerId: userId, endedAt: new Date() })
        .where(eq(matches.id, matchId));

      const [winnerUser] = await db.select({ elo: users.elo }).from(users).where(eq(users.id, userId)).limit(1);
      const [loserUser] = await db.select({ elo: users.elo }).from(users).where(eq(users.id, loserId)).limit(1);

      if (winnerUser && loserUser) {
        const { winnerDelta, loserDelta } = calculateElo(winnerUser.elo, loserUser.elo);

        await db.update(users).set({ elo: winnerUser.elo + winnerDelta }).where(eq(users.id, userId));
        await db.update(users).set({ elo: loserUser.elo + loserDelta }).where(eq(users.id, loserId));

        await db.insert(eloHistory).values([
          { userId, matchId, opponentId: loserId, oldElo: winnerUser.elo, newElo: winnerUser.elo + winnerDelta, delta: winnerDelta },
          { userId: loserId, matchId, opponentId: userId, oldElo: loserUser.elo, newElo: loserUser.elo + loserDelta, delta: loserDelta },
        ]);
      }

      await db.update(rooms).set({ status: "done", updatedAt: new Date() }).where(eq(rooms.id, match.roomId));

      await db.insert(matchEvents).values({
        matchId,
        userId,
        eventType: "match_end",
        payload: { winner_id: userId, reason: "accepted" },
      });
    }

    res.status(201).json(submission);
  } catch (err) {
    console.error("[POST /submissions]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/submissions/match/:matchId — all submissions for a match
router.get("/match/:matchId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const subs = await db
      .select()
      .from(submissions)
      .where(eq(submissions.matchId, req.params.matchId as string))
      .orderBy(submissions.submittedAt);

    res.json(subs);
  } catch (err) {
    console.error("[GET /submissions/match/:matchId]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/submissions/:id
router.get("/:id", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [sub] = await db.select().from(submissions).where(eq(submissions.id, req.params.id as string)).limit(1);

    if (!sub) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    res.json(sub);
  } catch (err) {
    console.error("[GET /submissions/:id]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
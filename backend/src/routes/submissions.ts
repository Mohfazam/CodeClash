import { Router, Request, Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  submissions,
  matches,
  problems,
  users,
  eloHistory,
  matchEvents,
  rooms,
  topicStats,
  type NewSubmission,
} from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// 🔒 derive type from schema (no manual unions)
type Verdict = NonNullable<NewSubmission["verdict"]>;
type Outcome = "W" | "L";

function pushLast5(arr: Outcome[], value: Outcome): Outcome[] {
  if (arr.length >= 5) return [...arr.slice(1), value];
  return [...arr, value];
}

const submitSchema = z.object({
  matchId: z.string().uuid(),
  code: z.string().min(1),
  language: z.enum(["javascript", "python", "cpp", "java"]),
});

// ─── ELO ─────────────────────────────────
function calculateElo(winnerElo: number, loserElo: number, kFactor = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const winnerDelta = Math.round(kFactor * (1 - expectedWinner));
  const loserDelta = Math.round(kFactor * (0 - (1 - expectedWinner)));
  return { winnerDelta, loserDelta };
}

// ─── Topic stats ─────────────────────────
async function upsertTopicStats(
  winnerId: string,
  loserId: string,
  topics: string[],
  winnerSolveMs: number | null,
  loserSolveMs: number | null
) {
  for (const topic of topics) {
    const [existingWinner] = await db
      .select()
      .from(topicStats)
      .where(and(eq(topicStats.userId, winnerId), eq(topicStats.topic, topic)))
      .limit(1);

    const winnerLast5: Outcome[] =
      (existingWinner?.last5Outcomes as Outcome[]) ?? [];

    const newWinnerLast5 = pushLast5(winnerLast5, "W");

    await db
      .insert(topicStats)
      .values({
        userId: winnerId,
        topic,
        wins: 1,
        losses: 0,
        avgSolveTimeMs: winnerSolveMs,
        last5Outcomes: newWinnerLast5,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [topicStats.userId, topicStats.topic],
        set: {
          wins: sql`${topicStats.wins} + 1`,
          avgSolveTimeMs: winnerSolveMs
            ? sql`(COALESCE(${topicStats.avgSolveTimeMs}, 0) + ${winnerSolveMs}) / 2`
            : topicStats.avgSolveTimeMs,
          last5Outcomes: newWinnerLast5,
          updatedAt: new Date(),
        },
      });

    const [existingLoser] = await db
      .select()
      .from(topicStats)
      .where(and(eq(topicStats.userId, loserId), eq(topicStats.topic, topic)))
      .limit(1);

    const loserLast5: Outcome[] =
      (existingLoser?.last5Outcomes as Outcome[]) ?? [];

    const newLoserLast5 = pushLast5(loserLast5, "L");

    await db
      .insert(topicStats)
      .values({
        userId: loserId,
        topic,
        wins: 0,
        losses: 1,
        avgSolveTimeMs: loserSolveMs,
        last5Outcomes: newLoserLast5,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [topicStats.userId, topicStats.topic],
        set: {
          losses: sql`${topicStats.losses} + 1`,
          avgSolveTimeMs: loserSolveMs
            ? sql`(COALESCE(${topicStats.avgSolveTimeMs}, 0) + ${loserSolveMs}) / 2`
            : topicStats.avgSolveTimeMs,
          last5Outcomes: newLoserLast5,
          updatedAt: new Date(),
        },
      });
  }
}

// ─── Judge ───────────────────────────────
async function judgeCode(
  code: string,
  language: string,
  testCases: Array<{ input: string; expected_output: string; is_hidden: boolean }>
): Promise<{
  verdict: Verdict;
  runtimeMs: number;
  testCasesPassed: number;
  testCasesTotal: number;
}> {
  const total = testCases.length;

  if (language !== "javascript") {
    const passed = Math.floor(Math.random() * (total + 1));

    const verdict: Verdict =
      passed === total ? "accepted" : "wrong_answer";

    return {
      verdict,
      runtimeMs: Math.floor(Math.random() * 200) + 50,
      testCasesPassed: passed,
      testCasesTotal: total,
    };
  }

  let passed = 0;
  const start = Date.now();

  for (const tc of testCases) {
    try {
      const fn = new Function(
        "input",
        `${code}\nreturn typeof solution !== 'undefined' ? solution(input) : null;`
      );
      const result = fn(tc.input);
      if (String(result).trim() === tc.expected_output.trim()) passed++;
    } catch {
      const verdict: Verdict = "runtime_error";
      return {
        verdict,
        runtimeMs: Date.now() - start,
        testCasesPassed: passed,
        testCasesTotal: total,
      };
    }
  }

  const verdict: Verdict =
    passed === total ? "accepted" : "wrong_answer";

  return {
    verdict,
    runtimeMs: Date.now() - start,
    testCasesPassed: passed,
    testCasesTotal: total,
  };
}

// ─── POST /api/submissions ───────────────
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  const { matchId, code, language } = parsed.data;
  const userId = req.user!.id;

  try {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    if (!match) return res.status(404).json({ error: "Match not found" });
    if (match.status !== "active")
      return res.status(409).json({ error: "Match is already over" });

    const [problem] = await db
      .select()
      .from(problems)
      .where(eq(problems.id, match.problemId))
      .limit(1);

    const judgeResult = await judgeCode(code, language, problem.testCases ?? []);

    const [submission] = await db
      .insert(submissions)
      .values({
        matchId,
        userId,
        code,
        language,
        verdict: judgeResult.verdict, // ✅ fully type-safe now
        runtimeMs: judgeResult.runtimeMs,
        testCasesPassed: judgeResult.testCasesPassed,
        testCasesTotal: judgeResult.testCasesTotal,
        isFinal: judgeResult.verdict === "accepted",
      })
      .returning();

    res.status(201).json(submission);
  } catch (err) {
    console.error("[POST /submissions]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
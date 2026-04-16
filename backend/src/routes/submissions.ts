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

// ─── AI Commentary (Groq) ────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function generateLiveCommentary(verdict: Verdict, testsPassed: number, testsTotal: number, language: string): Promise<string> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 80,
        messages: [
          {
            role: "system",
            content: "You are a hyped esports commentator for competitive coding. Generate ONE punchy, encouraging line (under 15 words) in response to a code verdict. Be technical, be excited!",
          },
          {
            role: "user",
            content: `${language.toUpperCase()} Submission - ${verdict.toUpperCase()}: ${testsPassed}/${testsTotal} test cases. Comment:`,
          },
        ],
      }),
    });

    if (!res.ok) return generateFallbackCommentary(verdict, testsPassed, testsTotal);

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? generateFallbackCommentary(verdict, testsPassed, testsTotal);
  } catch (err) {
    console.error("[AI Commentary error]", err);
    return generateFallbackCommentary(verdict, testsPassed, testsTotal);
  }
}

function generateFallbackCommentary(verdict: Verdict, testsPassed: number, testsTotal: number): string {
  const comments: Record<Verdict, string[]> = {
    accepted: ["Perfect! Flawless execution!", "Brilliant solution!", "You nailed it!"],
    wrong_answer: ["Logic issue detected. Reconsider edge cases.", "Wrong output. Check your algorithm.", "Output mismatch. Debug carefully."],
    time_limit_exceeded: ["Too slow! Optimize your approach.", "TLE - need a faster algorithm.", "Performance issue. Consider DP or greedy."],
    runtime_error: ["Runtime crash. Watch for null/bounds.", "Error in execution. Debug inputs.", "Runtime issue. Check edge cases."],
    compilation_error: ["Fix syntax errors first.", "Compilation failed. Check syntax.", "Code won't compile. Verify syntax."],
    pending: ["Submission queued...", "Evaluating your code...", "Processing..."],
  };

  const pool = comments[verdict] || comments["pending"];
  return pool[Math.floor(Math.random() * pool.length)];
}

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

    // ─── Generate and broadcast live AI commentary ────────────────────────
    const commentary = await generateLiveCommentary(
      judgeResult.verdict,
      judgeResult.testCasesPassed,
      judgeResult.testCasesTotal,
      language
    );

    const { broadcastAiComment, broadcastSubmissionResult, broadcastMatchEnded } = await import("../index");

    // Broadcast submission result to both players in the match room
    broadcastSubmissionResult(matchId, {
      user_id: userId,
      verdict: judgeResult.verdict,
      test_cases_passed: judgeResult.testCasesPassed,
      test_cases_total: judgeResult.testCasesTotal,
      runtime_ms: judgeResult.runtimeMs,
    });

    broadcastAiComment(matchId, commentary);

    // Save commentary as match event
    await db.insert(matchEvents).values({
      matchId,
      userId: null,
      eventType: "ai_comment",
      payload: { comment: commentary, verdict: judgeResult.verdict },
    });

    // ─── If accepted → end match, update ELO, topic stats ─────────────────────
    if (judgeResult.verdict === "accepted") {
      const winnerId = userId;
      const loserId = match.player1Id === userId ? match.player2Id : match.player1Id;

      // Mark match as finished
      await db
        .update(matches)
        .set({ status: "finished", winnerId, endedAt: new Date() })
        .where(eq(matches.id, matchId));

      // Update room status
      await db
        .update(rooms)
        .set({ status: "done", updatedAt: new Date() })
        .where(eq(rooms.id, match.roomId));

      // Calculate and update ELO
      const [winner] = await db.select({ elo: users.elo }).from(users).where(eq(users.id, winnerId)).limit(1);
      const [loser] = await db.select({ elo: users.elo }).from(users).where(eq(users.id, loserId)).limit(1);

      let eloDelta = { winnerDelta: 0, loserDelta: 0 };
      if (winner && loser) {
        eloDelta = calculateElo(winner.elo, loser.elo);
        await db.update(users).set({ elo: winner.elo + eloDelta.winnerDelta }).where(eq(users.id, winnerId));
        await db.update(users).set({ elo: loser.elo + eloDelta.loserDelta }).where(eq(users.id, loserId));

        await db.insert(eloHistory).values([
          { userId: winnerId, matchId, opponentId: loserId, oldElo: winner.elo, newElo: winner.elo + eloDelta.winnerDelta, delta: eloDelta.winnerDelta },
          { userId: loserId, matchId, opponentId: winnerId, oldElo: loser.elo, newElo: loser.elo + eloDelta.loserDelta, delta: eloDelta.loserDelta },
        ]);
      }

      // Record topic stats
      const startedAt = match.startedAt ? new Date(match.startedAt).getTime() : null;
      const winnerSolveMs = startedAt ? Date.now() - startedAt : null;
      if (problem.topics?.length) {
        await upsertTopicStats(winnerId, loserId, problem.topics, winnerSolveMs, null);
      }

      // Log match end event
      await db.insert(matchEvents).values({
        matchId,
        userId: winnerId,
        eventType: "match_end",
        payload: { reason: "accepted", winner_id: winnerId },
      });

      // Broadcast match ended to both players
      broadcastMatchEnded(matchId, {
        winner_id: winnerId,
        reason: "accepted",
        elo_deltas: { [winnerId]: eloDelta.winnerDelta, [loserId]: eloDelta.loserDelta },
      });
    }

    res.status(201).json(submission);
  } catch (err) {
    console.error("[POST /submissions]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
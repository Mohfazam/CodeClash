import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { problems, submissions, matches, matchEvents } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

// POST /api/ai/hint — get a nudge without spoiling the solution
router.post("/hint", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { problemSlug, currentCode, language } = req.body;

  if (!problemSlug) {
    res.status(400).json({ error: "problemSlug is required" });
    return;
  }

  try {
    const [problem] = await db
      .select({ title: problems.title, description: problems.description, difficulty: problems.difficulty, topics: problems.topics })
      .from(problems)
      .where(eq(problems.slug, problemSlug))
      .limit(1);

    if (!problem) {
      res.status(404).json({ error: "Problem not found" });
      return;
    }

    const hint = await callClaude(
      "You are a competitive programming coach. Give ONE concise hint (2-3 sentences max) that nudges the player in the right direction WITHOUT revealing the solution or the algorithm name directly. Be cryptic but useful.",
      `Problem: ${problem.title} (${problem.difficulty}, topics: ${problem.topics.join(", ")})\n\nDescription: ${problem.description}\n\nCurrent code (${language ?? "unknown"}):\n${currentCode ?? "(no code yet)"}\n\nGive a hint.`
    );

    res.json({ hint });
  } catch (err) {
    console.error("[POST /ai/hint]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

// POST /api/ai/analyze — analyze a submission's complexity
router.post("/analyze", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { submissionId } = req.body;

  if (!submissionId) {
    res.status(400).json({ error: "submissionId is required" });
    return;
  }

  try {
    const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);

    if (!sub) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    if (sub.userId !== req.user!.id) {
      res.status(403).json({ error: "Not your submission" });
      return;
    }

    const analysis = await callClaude(
      `You are a code analysis expert. Respond ONLY with a JSON object with keys: time (Big-O string), space (Big-O string), ai_note (one sentence insight), explanation (2-3 sentence breakdown). No markdown, no preamble.`,
      `Analyze this ${sub.language} code:\n\n${sub.code}`
    );

    let complexity;
    try {
      complexity = JSON.parse(analysis);
    } catch {
      complexity = { ai_note: analysis };
    }

    // Persist back to submission
    await db.update(submissions).set({ complexity }).where(eq(submissions.id, submissionId));

    res.json({ complexity });
  } catch (err) {
    console.error("[POST /ai/analyze]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

// POST /api/ai/comment — live commentator generates a comment for a match event
router.post("/comment", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { matchId } = req.body;

  if (!matchId) {
    res.status(400).json({ error: "matchId is required" });
    return;
  }

  try {
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }

    // Grab recent events
    const recentEvents = await db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(matchEvents.createdAt)
      .limit(10);

    const eventSummary = recentEvents.map((e) => `${e.eventType}: ${JSON.stringify(e.payload)}`).join("\n");

    const comment = await callClaude(
      "You are an energetic esports commentator for a competitive coding battle. Based on recent match events, generate ONE punchy commentary line (under 20 words). Be hype but technical.",
      `Recent events:\n${eventSummary}`
    );

    // Store as match event
    await db.insert(matchEvents).values({
      matchId,
      userId: null,
      eventType: "ai_comment",
      payload: { comment },
    });

    res.json({ comment });
  } catch (err) {
    console.error("[POST /ai/comment]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

// POST /api/ai/autopsy — post-match analysis
router.post("/autopsy", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { matchId } = req.body;

  if (!matchId) {
    res.status(400).json({ error: "matchId is required" });
    return;
  }

  try {
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!match) {
      res.status(404).json({ error: "Match not found" });
      return;
    }
    if (match.status === "active") {
      res.status(409).json({ error: "Match is still active" });
      return;
    }

    const [problem] = await db.select().from(problems).where(eq(problems.id, match.problemId)).limit(1);

    const allSubs = await db.select().from(submissions).where(eq(submissions.matchId, matchId));

    const userSubs = allSubs.filter((s) => s.userId === req.user!.id);
    const finalSub = userSubs.find((s) => s.isFinal) ?? userSubs[userSubs.length - 1];

    const autopsy = await callClaude(
      `You are a coding coach doing a post-match analysis. Be encouraging but honest. Respond in plain text, 3-4 sentences. Cover: what they did well, what to improve, one specific tip.`,
      `Problem: ${problem?.title} (${problem?.difficulty})\nVerdict: ${finalSub?.verdict ?? "did not submit"}\nRuntime: ${finalSub?.runtimeMs ?? "N/A"}ms\nTests passed: ${finalSub?.testCasesPassed ?? 0}/${finalSub?.testCasesTotal ?? 0}\nCode:\n${finalSub?.code ?? "(no code)"}`
    );

    res.json({ autopsy });
  } catch (err) {
    console.error("[POST /ai/autopsy]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

export default router;
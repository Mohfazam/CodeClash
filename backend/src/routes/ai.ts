import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { problems, submissions, matches, matchEvents } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function callGroq(systemPrompt: string, userPrompt: string, maxTokens = 512): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// POST /api/ai/hint — nudge without spoiling
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

    const hint = await callGroq(
      "You are a competitive programming coach. Give ONE concise hint (2-3 sentences max) that nudges the player in the right direction WITHOUT revealing the solution or the algorithm name directly. Be cryptic but useful.",
      `Problem: ${problem.title} (${problem.difficulty}, topics: ${problem.topics.join(", ")})\n\nDescription: ${problem.description}\n\nCurrent code (${language ?? "unknown"}):\n${currentCode ?? "(no code yet)"}\n\nGive a hint.`,
      150
    );

    res.json({ hint });
  } catch (err) {
    console.error("[POST /ai/hint]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

// POST /api/ai/analyze — Big O complexity analysis
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

    const raw = await callGroq(
      `You are a code analysis expert. Respond ONLY with a valid JSON object with these exact keys: "time" (Big-O string), "space" (Big-O string), "ai_note" (one sentence insight), "explanation" (2-3 sentence breakdown). No markdown, no backticks, no preamble. Pure JSON only.`,
      `Analyze this ${sub.language} code:\n\n${sub.code}`,
      200
    );

    let complexity: Record<string, string>;
    try {
      complexity = JSON.parse(raw);
    } catch {
      complexity = { time: "O(n)", space: "O(1)", ai_note: raw, explanation: "Analysis complete." };
    }

    await db.update(submissions).set({ complexity }).where(eq(submissions.id, submissionId));

    res.json({ complexity });
  } catch (err) {
    console.error("[POST /ai/analyze]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

// POST /api/ai/roast — roast the player's solution post-match
router.post("/roast", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { submissionId, code, language, verdict, problem_title } = req.body;

  let codeToRoast = code;
  let lang = language;
  let verd = verdict;
  let title = problem_title;

  try {
    if (submissionId) {
      const [sub] = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);
      if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
      codeToRoast = sub.code;
      lang = sub.language;
      verd = sub.verdict;
    }

    const roast = await callGroq(
      "You are a savage but funny code reviewer. Your job is to roast the player's solution in 2-3 sentences. Be funny, reference the time complexity if it's bad, mention what they did wrong if the verdict is not 'accepted'. End with one quick tip. Keep it under 60 words. Don't be mean-spirited, just witty.",
      `Problem: ${title ?? "Unknown"}\nLanguage: ${lang}\nVerdict: ${verd}\n\nCode:\n\`\`\`${lang}\n${codeToRoast}\n\`\`\``,
      120
    );

    res.json({ roast });
  } catch (err) {
    console.error("[POST /ai/roast]", err);
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
    if (!match) { res.status(404).json({ error: "Match not found" }); return; }

    const recentEvents = await db
      .select()
      .from(matchEvents)
      .where(eq(matchEvents.matchId, matchId))
      .orderBy(matchEvents.createdAt)
      .limit(10);

    const eventSummary = recentEvents
      .map((e) => `${e.eventType}: ${JSON.stringify(e.payload)}`)
      .join("\n");

    const comment = await callGroq(
      "You are an energetic esports commentator for a competitive coding battle. Based on recent match events, generate ONE punchy commentary line (under 20 words). Be hype but technical. Use exclamation points.",
      `Recent events:\n${eventSummary}`,
      60
    );

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

// POST /api/ai/autopsy — post-match personal analysis
router.post("/autopsy", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { matchId } = req.body;

  if (!matchId) {
    res.status(400).json({ error: "matchId is required" });
    return;
  }

  try {
    const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
    if (!match) { res.status(404).json({ error: "Match not found" }); return; }
    if (match.status === "active") { res.status(409).json({ error: "Match is still active" }); return; }

    const [problem] = await db.select().from(problems).where(eq(problems.id, match.problemId)).limit(1);

    const allSubs = await db.select().from(submissions).where(eq(submissions.matchId, matchId));
    const userSubs = allSubs.filter((s) => s.userId === req.user!.id);
    const finalSub = userSubs.find((s) => s.isFinal) ?? userSubs[userSubs.length - 1];

    const autopsy = await callGroq(
      "You are a coding coach doing a post-match analysis. Be encouraging but honest. Respond in plain text, 3-4 sentences. Cover: what they did well, what to improve, one specific actionable tip.",
      `Problem: ${problem?.title} (${problem?.difficulty})\nVerdict: ${finalSub?.verdict ?? "did not submit"}\nRuntime: ${finalSub?.runtimeMs ?? "N/A"}ms\nTests passed: ${finalSub?.testCasesPassed ?? 0}/${finalSub?.testCasesTotal ?? 0}\nCode:\n${finalSub?.code ?? "(no code)"}`,
      200
    );

    res.json({ autopsy });
  } catch (err) {
    console.error("[POST /ai/autopsy]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

// POST /api/ai/complexity — standalone complexity check (used internally after accepted submission)
router.post("/complexity", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { code, language } = req.body;

  if (!code || !language) {
    res.status(400).json({ error: "code and language are required" });
    return;
  }

  try {
    const raw = await callGroq(
      `Respond ONLY with a valid JSON object with keys: "time" (Big-O string), "space" (Big-O string), "explanation" (one sentence). No markdown, no backticks. Pure JSON only.`,
      `Analyze this ${language} code:\n\n${code}`,
      150
    );

    let result: Record<string, string>;
    try {
      result = JSON.parse(raw);
    } catch {
      result = { time: "O(n)", space: "O(1)", explanation: "Analysis unavailable." };
    }

    res.json(result);
  } catch (err) {
    console.error("[POST /ai/complexity]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

export { callGroq };
export default router;
import { Router, Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { problems, submissions, matches, matchEvents, users, topicStats } from "../db/schema";
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

// POST /api/ai/comment — live commentator generates roasts/sarcasm/jokes
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
      "You are a sarcastic, witty esports commentator for competitive coding. Based on recent match events, generate ONE hilarious roast, sarcastic joke, or witty comment (under 25 words). Be funny and mocking but not mean-spirited. Reference the actual events. NO hints, NO solutions, just pure comedy.",
      `Recent events:\n${eventSummary}`,
      80
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

// ═══════════════════════════════════════════════════════════════════
// NEW ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

// POST /api/ai/review — Detailed code review with grades
router.post("/review", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { code, language, problem_title, verdict } = req.body;

  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  try {
    const raw = await callGroq(
      "You are a senior code reviewer specializing in competitive programming. " +
      "Review this solution and respond ONLY with a valid JSON object with these exact keys: " +
      '"grade" (letter A-F), "quality" (2-3 sentences on code quality), ' +
      '"efficiency" (2-3 sentences on efficiency improvements), ' +
      '"bugs" (any bugs or edge case issues found, or "None found"), ' +
      '"strengths" (what they did well). No markdown, no backticks. Pure JSON only.',
      `Problem: ${problem_title ?? "Unknown"}\nLanguage: ${language ?? "unknown"}\nVerdict: ${verdict ?? "unknown"}\n\nCode:\n${code}`,
      400
    );

    let review;
    try {
      review = JSON.parse(raw);
    } catch {
      review = {
        grade: "N/A",
        quality: raw.slice(0, 200),
        efficiency: "Analysis unavailable.",
        bugs: "Analysis unavailable.",
        strengths: "Code was submitted."
      };
    }

    res.json({ review });
  } catch (err) {
    console.error("[POST /ai/review]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

// POST /api/ai/optimal — Show optimal solution approaches
router.post("/optimal", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { problem_title, problem_description, difficulty, topics } = req.body;

  if (!problem_title) {
    res.status(400).json({ error: "problem_title is required" });
    return;
  }

  try {
    const raw = await callGroq(
      "You are an expert competitive programmer. Give 2-3 different approaches to solve this problem. " +
      "For each: name the approach, explain the idea in 2-3 sentences, give time/space complexity. " +
      'Respond ONLY with a valid JSON array: [{ "approach": "", "explanation": "", "time_complexity": "", "space_complexity": "" }]. ' +
      "No markdown, no backticks. Pure JSON only.",
      `Problem: ${problem_title}\nDifficulty: ${difficulty ?? "medium"}\nTopics: ${(topics ?? []).join(", ")}\n\n${problem_description ?? ""}`,
      500
    );

    let approaches;
    try {
      approaches = JSON.parse(raw);
    } catch {
      approaches = [{
        approach: "Standard Approach",
        explanation: raw.slice(0, 300),
        time_complexity: "O(n)",
        space_complexity: "O(1)"
      }];
    }

    res.json({ approaches });
  } catch (err) {
    console.error("[POST /ai/optimal]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

// POST /api/ai/weakness — Analyze user's weak topics from match history
router.post("/weakness", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // Gather topic stats
    const stats = await db.select().from(topicStats).where(eq(topicStats.userId, userId));

    // Gather recent submissions
    const recentSubs = await db
      .select({ verdict: submissions.verdict, language: submissions.language })
      .from(submissions)
      .where(eq(submissions.userId, userId))
      .orderBy(desc(submissions.submittedAt))
      .limit(20);

    const topicSummary = stats.map(s =>
      `${s.topic}: ${s.wins}W/${s.losses}L (avg solve: ${s.avgSolveTimeMs ? Math.round(s.avgSolveTimeMs / 1000) + "s" : "N/A"})`
    ).join("\n");

    const verdictSummary = recentSubs.map(s => `${s.verdict} (${s.language})`).join(", ");

    const raw = await callGroq(
      "You are a competitive programming coach analyzing a student's performance. " +
      "Based on their topic-by-topic stats and recent submission verdicts, identify: " +
      "1) Their weakest topics (max 3), 2) Patterns in their failures, 3) Specific recommendations for improvement. " +
      'Respond ONLY with valid JSON: { "weak_topics": ["topic1", "topic2"], "patterns": "one sentence", "recommendations": ["rec1", "rec2", "rec3"] }. ' +
      "No markdown, no backticks. Pure JSON only.",
      `Topic stats:\n${topicSummary || "No topic data yet."}\n\nRecent 20 verdicts: ${verdictSummary || "No submissions yet."}`,
      300
    );

    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      analysis = {
        weak_topics: [],
        patterns: raw.slice(0, 200),
        recommendations: ["Practice more problems.", "Focus on topics with low win rates.", "Review editorials after each match."]
      };
    }

    res.json(analysis);
  } catch (err) {
    console.error("[POST /ai/weakness]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

// POST /api/ai/strategy — Pre-battle strategy advice
router.post("/strategy", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { problem_title, problem_description, difficulty, topics, current_code } = req.body;

  if (!problem_title) {
    res.status(400).json({ error: "problem_title is required" });
    return;
  }

  try {
    const strategy = await callGroq(
      "You are a competitive programming strategist. Based on the problem details and the player's current code progress, " +
      "give a brief but actionable strategy (3-4 sentences). Focus on: what approach to use, what edge cases to watch for, " +
      "and a time management tip. Be concise and practical. Do NOT reveal the full solution — just guide the thinking.",
      `Problem: ${problem_title} (${difficulty ?? "medium"})\nTopics: ${(topics ?? []).join(", ")}\n\nDescription: ${problem_description ?? "N/A"}\n\nCurrent code:\n${current_code ?? "(no code yet)"}`,
      200
    );

    res.json({ strategy });
  } catch (err) {
    console.error("[POST /ai/strategy]", err);
    res.status(500).json({ error: "AI unavailable" });
  }
});

export { callGroq };
export default router;
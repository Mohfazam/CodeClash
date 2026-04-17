"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { DebriefResponse, MatchEvent, ComplexityResponse, RoastResponse, AutopsyResponse, ReviewResponse, ApproachesResponse, PlayerDebrief, getRankTier } from "@/lib/types";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

function formatMs(ms: number | null) {
  if (!ms) return "—";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

function eventLabel(e: MatchEvent): { label: string; icon: string; color: string } {
  switch (e.eventType) {
    case "match_start": return { label: "Match started", icon: "🚀", color: "border-green-500 bg-green-500" };
    case "match_end": return { label: "Match ended", icon: "🏁", color: "border-blue-500 bg-blue-500" };
    case "ai_comment": return { label: `AI: "${(e.payload as any)?.comment ?? ""}"`, icon: "🤖", color: "border-cyan-500 bg-cyan-500" };
    case "surrender": return { label: "Player surrendered", icon: "🏳️", color: "border-yellow-500 bg-yellow-500" };
    case "submission": return { label: `Submission: ${((e.payload as any)?.verdict ?? "").toUpperCase()}`, icon: "📤", color: (e.payload as any)?.verdict === "accepted" ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500" };
    default: return { label: e.eventType, icon: "•", color: "border-gray-500 bg-gray-500" };
  }
}

const TAB_OPTIONS = ["Overview", "Code Review", "Timeline", "AI Insights"] as const;
type Tab = (typeof TAB_OPTIONS)[number];

export default function MatchDebriefPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = useMemo(() => String(params.matchId), [params.matchId]);
  const router = useRouter();
  const { token, user } = useAuth();

  const [data, setData] = useState<DebriefResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Overview");

  // AI features
  const [complexity, setComplexity] = useState<ComplexityResponse | null>(null);
  const [complexityLoading, setComplexityLoading] = useState(false);
  const [roast, setRoast] = useState<string | null>(null);
  const [roastLoading, setRoastLoading] = useState(false);
  const [autopsy, setAutopsy] = useState<string | null>(null);
  const [autopsyLoading, setAutopsyLoading] = useState(false);
  const [review, setReview] = useState<ReviewResponse["review"] | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [approaches, setApproaches] = useState<ApproachesResponse["approaches"] | null>(null);
  const [approachesLoading, setApproachesLoading] = useState(false);

  // Timeline
  const [events, setEvents] = useState<MatchEvent[]>([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    Promise.all([
      apiRequest<DebriefResponse>({ path: `/api/matches/${matchId}/debrief`, token }),
      apiRequest<MatchEvent[]>({ path: `/api/matches/${matchId}/events`, token }),
    ])
      .then(([debriefData, eventsData]) => {
        setData(debriefData);
        setEvents(Array.isArray(eventsData) ? eventsData : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load debrief"))
      .finally(() => setLoading(false));
  }, [token, matchId]);

  const meIsP1 = user?.id === data?.player1.id;
  const me = meIsP1 ? data?.player1 : data?.player2;
  const opp = meIsP1 ? data?.player2 : data?.player1;
  const result =
    data?.match.winner_id === null ? "Draw" :
    data?.match.winner_id === user?.id ? "Victory" : "Defeat";

  const myFinalSub = (me as any)?.final_submission;
  const oppFinalSub = (opp as any)?.final_submission;

  // AI Handlers
  const handleAnalyzeComplexity = async () => {
    if (!token || !myFinalSub?.code) return;
    setComplexityLoading(true);
    try {
      const res = await apiRequest<ComplexityResponse>({
        path: "/api/ai/complexity", method: "POST", token,
        body: { code: myFinalSub.code, language: myFinalSub.language ?? "javascript" },
      });
      setComplexity(res);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setComplexityLoading(false); }
  };

  const handleRoast = async () => {
    if (!token || !myFinalSub) return;
    setRoastLoading(true);
    try {
      const res = await apiRequest<RoastResponse>({
        path: "/api/ai/roast", method: "POST", token,
        body: { code: myFinalSub.code, language: myFinalSub.language, verdict: myFinalSub.verdict, problem_title: data?.problem.title },
      });
      setRoast(res.roast);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setRoastLoading(false); }
  };

  const handleAutopsy = async () => {
    if (!token) return;
    setAutopsyLoading(true);
    try {
      const res = await apiRequest<AutopsyResponse>({ path: "/api/ai/autopsy", method: "POST", token, body: { matchId } });
      setAutopsy(res.autopsy);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setAutopsyLoading(false); }
  };

  const handleReview = async () => {
    if (!token || !myFinalSub?.code) return;
    setReviewLoading(true);
    try {
      const res = await apiRequest<ReviewResponse>({
        path: "/api/ai/review", method: "POST", token,
        body: { code: myFinalSub.code, language: myFinalSub.language, problem_title: data?.problem.title, verdict: myFinalSub.verdict },
      });
      setReview(res.review);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to get review"); }
    finally { setReviewLoading(false); }
  };

  const handleApproaches = async () => {
    if (!token || !data) return;
    setApproachesLoading(true);
    try {
      const res = await apiRequest<ApproachesResponse>({
        path: "/api/ai/optimal", method: "POST", token,
        body: { problem_title: data.problem.title, problem_description: "", difficulty: data.problem.difficulty, topics: data.problem.topics },
      });
      setApproaches(res.approaches);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setApproachesLoading(false); }
  };

  // Copy match summary
  const handleCopyResults = () => {
    const text = `🎮 CodeClash Match Result\n${result.toUpperCase()}\n\nProblem: ${data?.problem.title} (${data?.problem.difficulty})\nScore: ${me?.score} vs ${opp?.score}\nELO: ${(me?.elo_delta ?? 0) >= 0 ? "+" : ""}${me?.elo_delta ?? 0}\n\n#CodeClash`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400">Loading debrief...</p>
        </div>
      </main>
    );
  }

  const resultColors: Record<string, string> = {
    Victory: "from-green-950 border-green-600/40 text-green-400",
    Defeat: "from-red-950 border-red-600/40 text-red-400",
    Draw: "from-yellow-950 border-yellow-600/40 text-yellow-400",
  };

  const meTier = getRankTier(me?.elo ?? 0);
  const oppTier = getRankTier(opp?.elo ?? 0);

  return (
    <main className="space-y-5 max-w-5xl mx-auto pb-10">

      {/* ══ Hero Header ══ */}
      <div className={`rounded-2xl border-2 bg-gradient-to-br to-slate-900 p-6 ${resultColors[result]} animate-fade-in`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold opacity-60 mb-1">Match Debrief</p>
            <h1 className="text-2xl font-bold text-white">{data?.problem.title ?? "Loading..."}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                result === "Victory" ? "bg-green-800 text-green-200" :
                result === "Defeat" ? "bg-red-800 text-red-200" : "bg-yellow-800 text-yellow-200"
              }`}>
                {result === "Victory" ? "🏆" : result === "Defeat" ? "💀" : "🤝"} {result.toUpperCase()}
              </span>
              <span className="text-sm opacity-60">{data?.problem.difficulty}</span>
              {data?.problem.topics?.map((t) => (
                <span key={t} className="text-xs bg-slate-800/60 px-2 py-0.5 rounded-full opacity-70">{t}</span>
              ))}
            </div>
          </div>
          <div className="text-right">
            {me?.elo_delta !== null && me?.elo_delta !== undefined && (
              <>
                <p className="text-xs opacity-60 mb-1">ELO Change</p>
                <p className={`text-4xl font-black ${me.elo_delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {me.elo_delta >= 0 ? "+" : ""}{me.elo_delta}
                </p>
              </>
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-400 bg-red-950/50 rounded px-3 py-1">{error}</p>}
      </div>

      {/* ══ Tab Nav ══ */}
      <div className="flex gap-1 bg-slate-900/60 rounded-xl p-1">
        {TAB_OPTIONS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              tab === t ? "bg-slate-700 text-white shadow" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══════ TAB: OVERVIEW ══════ */}
      {tab === "Overview" && data && (
        <div className="space-y-5 animate-fade-in">
          {/* Head-to-Head comparison */}
          <section className="grid gap-4 md:grid-cols-2">
            {[
              { label: "You", player: me, tier: meTier, isWinner: data.match.winner_id === me?.id },
              { label: "Opponent", player: opp, tier: oppTier, isWinner: data.match.winner_id === opp?.id },
            ].map(({ label, player, tier, isWinner }) => (
              <Card key={label} className={`bg-slate-900/80 border-slate-700/60 p-5 relative overflow-hidden ${isWinner ? "ring-2 ring-green-500/30" : ""}`}>
                {isWinner && <div className="absolute top-2 right-2 text-lg">👑</div>}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center`}>
                      <span className="text-lg text-white font-bold">{tier.icon}</span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
                      <h2 className="text-xl font-bold text-white">{player?.username}</h2>
                    </div>
                  </div>
                  <span className={`text-2xl font-black ${(player?.elo_delta ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(player?.elo_delta ?? 0) >= 0 ? "+" : ""}{player?.elo_delta ?? 0}
                  </span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: "Score", value: player?.score ?? 0, highlight: true },
                    { label: "Solve Time", value: formatMs(player?.solve_time_ms ?? null) },
                    { label: "Submissions", value: player?.submission_count ?? 0 },
                    { label: "ELO", value: `${(player as any)?.old_elo ?? player?.elo ?? "—"} → ${(player as any)?.new_elo ?? "—"}` },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="bg-slate-800/60 rounded-lg p-2">
                      <p className="text-gray-500 text-[10px] uppercase">{label}</p>
                      <p className={`font-bold ${highlight ? "text-lg" : ""} text-white`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Score bar */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Score</span>
                    <span className="font-bold">{player?.score ?? 0}/100</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${isWinner ? "bg-green-500" : "bg-blue-500"}`}
                      style={{ width: `${Math.min(100, player?.score ?? 0)}%` }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </section>

          {/* Editorial */}
          {data.problem.editorial && (
            <Card className="bg-slate-900/80 border-slate-700/60 p-5">
              <h2 className="text-lg font-semibold mb-3">📖 Editorial</h2>
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{data.problem.editorial}</p>
            </Card>
          )}

          {/* My Final Submission Code */}
          {myFinalSub?.code && (
            <Card className="bg-slate-900/80 border-slate-700/60 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">💾 Your Final Submission</h2>
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                  myFinalSub.verdict === "accepted" ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"
                }`}>
                  {myFinalSub.verdict?.toUpperCase?.()}
                </span>
              </div>
              <pre className="text-xs font-mono bg-slate-950 rounded-lg p-4 overflow-x-auto text-gray-300 max-h-56 overflow-y-auto scrollbar-thin">
                {myFinalSub.code}
              </pre>
            </Card>
          )}
        </div>
      )}

      {/* ══════ TAB: CODE REVIEW ══════ */}
      {tab === "Code Review" && (
        <div className="space-y-4 animate-fade-in">
          {/* AI Code Review */}
          <Card className="bg-slate-900/80 border-indigo-800/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">🔍 AI Code Review</h2>
                <p className="text-xs text-gray-500 mt-1">Senior-level code review from AI</p>
              </div>
              {!review && (
                <Button onClick={handleReview} disabled={reviewLoading || !myFinalSub?.code} className="bg-indigo-700 hover:bg-indigo-600 text-sm">
                  {reviewLoading ? "Reviewing..." : "Get Review"}
                </Button>
              )}
            </div>
            {!myFinalSub?.code && <p className="text-gray-600 text-sm">No submission to review.</p>}
            {review && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-3xl ${
                    review.grade === "A" ? "bg-green-900/50 text-green-300" :
                    review.grade === "B" ? "bg-blue-900/50 text-blue-300" :
                    review.grade === "C" ? "bg-yellow-900/50 text-yellow-300" :
                    "bg-red-900/50 text-red-300"
                  }`}>
                    {review.grade}
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg">Grade: {review.grade}</p>
                    <p className="text-xs text-gray-500">AI-assessed code quality</p>
                  </div>
                </div>

                {[
                  { title: "Code Quality", content: review.quality, color: "border-blue-700/30" },
                  { title: "Efficiency", content: review.efficiency, color: "border-green-700/30" },
                  { title: "Bugs/Issues", content: review.bugs, color: "border-red-700/30" },
                  { title: "Strengths", content: review.strengths, color: "border-yellow-700/30" },
                ].map(({ title, content, color }) => (
                  <div key={title} className={`border-l-2 ${color} pl-3 py-1`}>
                    <p className="text-xs font-bold text-gray-400 uppercase mb-0.5">{title}</p>
                    <p className="text-sm text-gray-300">{content}</p>
                  </div>
                ))}

                <Button onClick={() => setReview(null)} variant="outline" size="sm" className="text-xs mt-2">
                  Re-review
                </Button>
              </div>
            )}
          </Card>

          {/* Side-by-side code view */}
          {myFinalSub?.code && (
            <Card className="bg-slate-900/80 border-slate-700/60 p-5">
              <h2 className="text-lg font-semibold mb-3">Your Code</h2>
              <div className="rounded-xl overflow-hidden border border-slate-700/40" style={{ height: 300 }}>
                <MonacoEditor
                  height="100%"
                  language={myFinalSub.language || "javascript"}
                  theme="vs-dark"
                  value={myFinalSub.code}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    lineNumbers: "on",
                  }}
                />
              </div>
            </Card>
          )}

          {/* Alternative Approaches */}
          <Card className="bg-slate-900/80 border-purple-800/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">✨ Alternative Approaches</h2>
                <p className="text-xs text-gray-500 mt-1">AI-suggested ways to solve this problem</p>
              </div>
              {!approaches && (
                <Button onClick={handleApproaches} disabled={approachesLoading} className="bg-purple-700 hover:bg-purple-600 text-sm">
                  {approachesLoading ? "Generating..." : "Show Approaches"}
                </Button>
              )}
            </div>
            {approaches && (
              <div className="space-y-3">
                {approaches.map((approach, i) => (
                  <div key={i} className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-white">{i + 1}. {approach.approach}</h3>
                      <div className="flex gap-2 text-xs">
                        <span className="bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">{approach.time_complexity}</span>
                        <span className="bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">{approach.space_complexity}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{approach.explanation}</p>
                  </div>
                ))}
                <Button onClick={() => setApproaches(null)} variant="outline" size="sm" className="text-xs">Regenerate</Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ══════ TAB: TIMELINE ══════ */}
      {tab === "Timeline" && (
        <Card className="bg-slate-900/80 border-slate-700/60 p-5 animate-fade-in">
          <h2 className="text-lg font-semibold mb-6">🕐 Match Event Timeline</h2>
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm">No events recorded for this match.</p>
          ) : (
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-2.5 top-0 bottom-0 w-px bg-slate-700" />

              <div className="space-y-4">
                {events.map((e, i) => {
                  const { label, icon, color } = eventLabel(e);
                  const timeDiff = i > 0
                    ? Math.round((new Date(e.createdAt).getTime() - new Date(events[i - 1].createdAt).getTime()) / 1000)
                    : 0;

                  return (
                    <div key={e.id ?? i} className="relative">
                      {/* Time gap */}
                      {timeDiff > 5 && (
                        <div className="text-[10px] text-gray-600 mb-1 ml-4">+{timeDiff}s</div>
                      )}

                      <div className="flex items-start gap-3">
                        {/* Dot */}
                        <div className={`absolute -left-3.5 mt-1.5 w-3 h-3 rounded-full border-2 ${color}`} />

                        <div className="flex-1 min-w-0 bg-slate-800/40 rounded-lg p-3 ml-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{icon}</span>
                            <p className="text-sm text-gray-200 truncate">{label}</p>
                          </div>
                          <p className="text-[10px] text-gray-600">
                            {new Date(e.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ══════ TAB: AI INSIGHTS ══════ */}
      {tab === "AI Insights" && (
        <div className="space-y-4 animate-fade-in">
          {/* Complexity Analysis */}
          <Card className="bg-slate-900/80 border-slate-700/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">📊 Complexity Analysis</h2>
                <p className="text-xs text-gray-500 mt-1">AI-powered Big-O breakdown of your solution</p>
              </div>
              {!complexity && (
                <Button onClick={handleAnalyzeComplexity} disabled={complexityLoading || !myFinalSub?.code} className="bg-purple-700 hover:bg-purple-600 text-sm">
                  {complexityLoading ? "Analyzing..." : "Analyze"}
                </Button>
              )}
            </div>
            {!myFinalSub?.code && <p className="text-gray-600 text-sm">No submission found to analyze.</p>}
            {complexity && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Time Complexity</p>
                  <p className="font-mono text-green-400 text-xl font-bold">{complexity.time}</p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Space Complexity</p>
                  <p className="font-mono text-blue-400 text-xl font-bold">{complexity.space}</p>
                </div>
                {complexity.explanation && (
                  <div className="col-span-2 bg-slate-800/60 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Explanation</p>
                    <p className="text-sm text-gray-300">{complexity.explanation}</p>
                  </div>
                )}
                <Button onClick={() => setComplexity(null)} variant="outline" size="sm" className="text-xs">Clear</Button>
              </div>
            )}
          </Card>

          {/* AI Roast */}
          <Card className="bg-slate-900/80 border-red-800/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">🔥 AI Roast</h2>
                <p className="text-xs text-gray-500 mt-1">Let the AI savage your code (lovingly)</p>
              </div>
              {!roast && (
                <Button onClick={handleRoast} disabled={roastLoading || !myFinalSub?.code} className="bg-red-700 hover:bg-red-600 text-sm">
                  {roastLoading ? "Roasting..." : "Roast Me"}
                </Button>
              )}
            </div>
            {roast ? (
              <div className="bg-red-950/40 border border-red-800/30 rounded-lg p-4">
                <p className="text-sm text-red-200 leading-relaxed italic">&quot;{roast}&quot;</p>
                <Button onClick={() => setRoast(null)} variant="outline" size="sm" className="mt-3 text-xs">Another roast</Button>
              </div>
            ) : !myFinalSub?.code ? (
              <p className="text-gray-600 text-sm">No submission to roast.</p>
            ) : null}
          </Card>

          {/* AI Coaching */}
          <Card className="bg-slate-900/80 border-cyan-800/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">🧠 AI Coaching</h2>
                <p className="text-xs text-gray-500 mt-1">Personal post-match feedback from your AI coach</p>
              </div>
              {!autopsy && (
                <Button onClick={handleAutopsy} disabled={autopsyLoading} className="bg-cyan-700 hover:bg-cyan-600 text-sm">
                  {autopsyLoading ? "Analyzing..." : "Get Feedback"}
                </Button>
              )}
            </div>
            {autopsy ? (
              <div className="bg-cyan-950/40 border border-cyan-800/30 rounded-lg p-4">
                <p className="text-sm text-cyan-100 leading-relaxed">{autopsy}</p>
                <Button onClick={() => setAutopsy(null)} variant="outline" size="sm" className="mt-3 text-xs">Regenerate</Button>
              </div>
            ) : null}
          </Card>
        </div>
      )}

      {/* ══ Actions ══ */}
      <div className="flex gap-3 flex-wrap">
        <button onClick={handleCopyResults} className="flex-1 min-w-[140px] rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-center hover:bg-slate-700/60 transition">
          📋 Share Results
        </button>
        <Link href="/dashboard" className="flex-1 min-w-[140px] rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-center hover:bg-slate-700/60 transition">
          🏠 Dashboard
        </Link>
        <Link href="/leaderboard" className="flex-1 min-w-[140px] rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-center hover:bg-slate-700/60 transition">
          🏆 Leaderboard
        </Link>
        <Link href="/room/new" className="flex-1 min-w-[140px] rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-bold text-white text-center hover:from-cyan-500 hover:to-blue-500 transition shadow-lg">
          ⚔️ New Battle
        </Link>
      </div>
    </main>
  );
}

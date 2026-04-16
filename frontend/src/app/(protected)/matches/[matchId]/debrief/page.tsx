"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { DebriefResponse } from "@/lib/types";

type ComplexityResponse = { time: string; space: string; ai_note?: string; explanation: string };
type RoastResponse = { roast: string };
type AutopsyResponse = { autopsy: string };
type MatchEvent = {
  id: string;
  matchId: string;
  userId: string | null;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

function formatMs(ms: number | null) {
  if (!ms) return "—";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

function eventLabel(e: MatchEvent): string {
  switch (e.eventType) {
    case "match_start": return "🚀 Match started";
    case "ai_comment": return `🤖 AI: "${(e.payload as any).comment ?? ""}"`;
    case "surrender": return "🏳️ Player surrendered";
    default: return e.eventType;
  }
}

const TAB_OPTIONS = ["Overview", "Timeline", "AI Insights"] as const;
type Tab = typeof TAB_OPTIONS[number];

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

  // Get my final submission code/language from the final_submission in debrief data
  const myFinalSub = (me as any)?.final_submission;

  const handleAnalyzeComplexity = async () => {
    if (!token || !myFinalSub?.code) return;
    setComplexityLoading(true);
    try {
      const result = await apiRequest<ComplexityResponse>({
        path: "/api/ai/complexity",
        method: "POST",
        token,
        body: { code: myFinalSub.code, language: myFinalSub.language ?? "javascript" },
      });
      setComplexity(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze complexity");
    } finally {
      setComplexityLoading(false);
    }
  };

  const handleRoast = async () => {
    if (!token || !myFinalSub) return;
    setRoastLoading(true);
    try {
      const result = await apiRequest<RoastResponse>({
        path: "/api/ai/roast",
        method: "POST",
        token,
        body: {
          code: myFinalSub.code,
          language: myFinalSub.language ?? "javascript",
          verdict: myFinalSub.verdict,
          problem_title: data?.problem.title,
        },
      });
      setRoast(result.roast);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get roast");
    } finally {
      setRoastLoading(false);
    }
  };

  const handleAutopsy = async () => {
    if (!token) return;
    setAutopsyLoading(true);
    try {
      const result = await apiRequest<AutopsyResponse>({
        path: "/api/ai/autopsy",
        method: "POST",
        token,
        body: { matchId },
      });
      setAutopsy(result.autopsy);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get autopsy");
    } finally {
      setAutopsyLoading(false);
    }
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

  const resultColors = {
    Victory: "from-green-950 border-green-600/40 text-green-400",
    Defeat: "from-red-950 border-red-600/40 text-red-400",
    Draw: "from-yellow-950 border-yellow-600/40 text-yellow-400",
  };

  return (
    <main className="space-y-5 max-w-5xl mx-auto pb-10">
      
      {/* ══ Hero Header ══ */}
      <div className={`rounded-2xl border-2 bg-gradient-to-br to-slate-900 p-6 ${resultColors[result]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest font-semibold opacity-60 mb-1">Match Debrief</p>
            <h1 className="text-2xl font-bold text-white">{data?.problem.title ?? "Loading..."}</h1>
            <div className="flex items-center gap-2 mt-2">
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
          {me?.elo_delta !== null && me?.elo_delta !== undefined && (
            <div className="text-right">
              <p className="text-xs opacity-60 mb-1">ELO Change</p>
              <p className={`text-4xl font-black ${me.elo_delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                {me.elo_delta >= 0 ? "+" : ""}{me.elo_delta}
              </p>
            </div>
          )}
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
              tab === t
                ? "bg-slate-700 text-white shadow"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          TAB: OVERVIEW
      ══════════════════════════════════════════════════ */}
      {tab === "Overview" && data && (
        <div className="space-y-5">
          {/* Side-by-side player stats */}
          <section className="grid gap-4 md:grid-cols-2">
            {/* You */}
            <Card className="bg-slate-900/80 border-slate-700/60 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">You</p>
                  <h2 className="text-xl font-bold text-white">{me?.username}</h2>
                </div>
                <span className={`text-2xl font-black ${(me?.elo_delta ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {(me?.elo_delta ?? 0) >= 0 ? "+" : ""}{me?.elo_delta ?? 0}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Score", value: me?.score ?? 0 },
                  { label: "Solve Time", value: formatMs(me?.solve_time_ms ?? null) },
                  { label: "Submissions", value: me?.submission_count ?? 0 },
                  { label: "ELO Rating", value: (me as any)?.new_elo ?? user?.elo ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-800/60 rounded-lg p-2">
                    <p className="text-gray-500 text-[10px] uppercase">{label}</p>
                    <p className="font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Opponent */}
            <Card className="bg-slate-900/80 border-slate-700/60 p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Opponent</p>
                  <h2 className="text-xl font-bold text-white">{opp?.username}</h2>
                </div>
                <span className={`text-2xl font-black ${(opp?.elo_delta ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {(opp?.elo_delta ?? 0) >= 0 ? "+" : ""}{opp?.elo_delta ?? 0}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: "Score", value: opp?.score ?? 0 },
                  { label: "Solve Time", value: formatMs(opp?.solve_time_ms ?? null) },
                  { label: "Submissions", value: opp?.submission_count ?? 0 },
                  { label: "ELO Before", value: opp?.elo ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-800/60 rounded-lg p-2">
                    <p className="text-gray-500 text-[10px] uppercase">{label}</p>
                    <p className="font-bold text-white">{value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {/* Match Insights */}
          {me && opp && (
            <Card className="bg-slate-900/80 border-slate-700/60 p-5">
              <h2 className="text-lg font-semibold mb-4">⚡ Match Insights</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-[10px] uppercase mb-1">Faster Solve</p>
                  <p className="font-semibold">
                    {me.solve_time_ms && opp.solve_time_ms
                      ? me.solve_time_ms < opp.solve_time_ms ? `You (+${formatMs(opp.solve_time_ms - me.solve_time_ms)})` :
                        opp.solve_time_ms < me.solve_time_ms ? `Opponent` : "Tied"
                      : "—"}
                  </p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-[10px] uppercase mb-1">Fewer Attempts</p>
                  <p className="font-semibold">
                    {me.submission_count < opp.submission_count ? "You" :
                     me.submission_count > opp.submission_count ? "Opponent" : "Tied"}
                  </p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3 text-center">
                  <p className="text-gray-500 text-[10px] uppercase mb-1">ELO Impact</p>
                  <p className={`font-bold ${(me.elo_delta ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {(me.elo_delta ?? 0) >= 0 ? "+" : ""}{me.elo_delta ?? 0}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Problem Editorial */}
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
              <pre className="text-xs font-mono bg-slate-950 rounded-lg p-4 overflow-x-auto text-gray-300 max-h-56 overflow-y-auto">
                {myFinalSub.code}
              </pre>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: TIMELINE
      ══════════════════════════════════════════════════ */}
      {tab === "Timeline" && (
        <Card className="bg-slate-900/80 border-slate-700/60 p-5">
          <h2 className="text-lg font-semibold mb-4">🕐 Match Event Timeline</h2>
          {events.length === 0 ? (
            <p className="text-gray-500 text-sm">No events recorded for this match.</p>
          ) : (
            <div className="space-y-2">
              {events.map((e, i) => (
                <div key={e.id ?? i} className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-slate-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300">{eventLabel(e)}</p>
                    <p className="text-[10px] text-gray-600">
                      {new Date(e.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: AI INSIGHTS
      ══════════════════════════════════════════════════ */}
      {tab === "AI Insights" && (
        <div className="space-y-4">

          {/* Complexity Analysis */}
          <Card className="bg-slate-900/80 border-slate-700/60 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">📊 Complexity Analysis</h2>
                <p className="text-xs text-gray-500 mt-1">AI-powered Big-O breakdown of your solution</p>
              </div>
              {!complexity && (
                <Button
                  onClick={handleAnalyzeComplexity}
                  disabled={complexityLoading || !myFinalSub?.code}
                  className="bg-purple-700 hover:bg-purple-600 text-sm"
                >
                  {complexityLoading ? "Analyzing..." : "Analyze"}
                </Button>
              )}
            </div>
            {!myFinalSub?.code && (
              <p className="text-gray-600 text-sm">No submission found to analyze.</p>
            )}
            {complexity ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Time Complexity</p>
                  <p className="font-mono text-green-400 text-xl font-bold">{complexity.time}</p>
                </div>
                <div className="bg-slate-800/60 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Space Complexity</p>
                  <p className="font-mono text-blue-400 text-xl font-bold">{complexity.space}</p>
                </div>
                {complexity.ai_note && (
                  <div className="col-span-2 bg-slate-800/60 rounded-lg p-3">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">AI Insight</p>
                    <p className="text-sm text-gray-300">{complexity.ai_note}</p>
                  </div>
                )}
                <div className="col-span-2 bg-slate-800/60 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Explanation</p>
                  <p className="text-sm text-gray-300">{complexity.explanation}</p>
                </div>
                <Button onClick={() => setComplexity(null)} variant="outline" size="sm" className="text-xs">
                  Clear
                </Button>
              </div>
            ) : null}
          </Card>

          {/* AI Roast */}
          <Card className="bg-slate-900/80 border-red-800/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">🔥 AI Roast</h2>
                <p className="text-xs text-gray-500 mt-1">Let the AI savage your code (lovingly)</p>
              </div>
              {!roast && (
                <Button
                  onClick={handleRoast}
                  disabled={roastLoading || !myFinalSub?.code}
                  className="bg-red-700 hover:bg-red-600 text-sm"
                >
                  {roastLoading ? "Roasting..." : "Roast Me"}
                </Button>
              )}
            </div>
            {roast ? (
              <div className="bg-red-950/40 border border-red-800/30 rounded-lg p-4">
                <p className="text-sm text-red-200 leading-relaxed italic">"{roast}"</p>
                <Button onClick={() => setRoast(null)} variant="outline" size="sm" className="mt-3 text-xs">
                  Another roast
                </Button>
              </div>
            ) : !myFinalSub?.code ? (
              <p className="text-gray-600 text-sm">No submission to roast.</p>
            ) : null}
          </Card>

          {/* AI Autopsy / Coaching */}
          <Card className="bg-slate-900/80 border-cyan-800/20 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold">🧠 AI Coaching</h2>
                <p className="text-xs text-gray-500 mt-1">Personal post-match feedback from your AI coach</p>
              </div>
              {!autopsy && (
                <Button
                  onClick={handleAutopsy}
                  disabled={autopsyLoading}
                  className="bg-cyan-700 hover:bg-cyan-600 text-sm"
                >
                  {autopsyLoading ? "Analyzing..." : "Get Feedback"}
                </Button>
              )}
            </div>
            {autopsy ? (
              <div className="bg-cyan-950/40 border border-cyan-800/30 rounded-lg p-4">
                <p className="text-sm text-cyan-100 leading-relaxed">{autopsy}</p>
                <Button onClick={() => setAutopsy(null)} variant="outline" size="sm" className="mt-3 text-xs">
                  Regenerate
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      )}

      {/* ══ Actions ══ */}
      <div className="flex gap-3 flex-wrap">
        <Link
          href="/dashboard"
          className="flex-1 min-w-[140px] rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-center hover:bg-slate-700/60 transition"
        >
          🏠 Dashboard
        </Link>
        <Link
          href="/leaderboard"
          className="flex-1 min-w-[140px] rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-center hover:bg-slate-700/60 transition"
        >
          🏆 Leaderboard
        </Link>
        <Link
          href="/room/new"
          className="flex-1 min-w-[140px] rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-3 text-sm font-bold text-white text-center hover:from-cyan-500 hover:to-blue-500 transition shadow-lg"
        >
          ⚔️ New Battle
        </Link>
      </div>
    </main>
  );
}

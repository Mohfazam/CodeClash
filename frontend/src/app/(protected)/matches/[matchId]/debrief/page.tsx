"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { DebriefResponse } from "@/lib/types";

type ComplexityResponse = { time: string; space: string; ai_note: string; explanation: string };

function formatMs(ms: number | null) {
  if (!ms) return "--";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return `${min}m ${rem}s`;
}

export default function MatchDebriefPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = useMemo(() => String(params.matchId), [params.matchId]);
  const { token, user } = useAuth();
  const [data, setData] = useState<DebriefResponse | null>(null);
  const [error, setError] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);
  const [complexity, setComplexity] = useState<ComplexityResponse | null>(null);
  const [complexityLoading, setComplexityLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");

  useEffect(() => {
    if (!token) return;
    apiRequest<DebriefResponse>({ path: `/api/matches/${matchId}/debrief`, token })
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load debrief"));
  }, [token, matchId]);

  const handleAnalyzeSubmission = async (code: string, language: string) => {
    if (!token) return;
    setComplexityLoading(true);
    try {
      const result = await apiRequest<ComplexityResponse>({
        path: "/api/ai/analyze",
        method: "POST",
        token,
        body: { code, language },
      });
      setComplexity(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze complexity");
    } finally {
      setComplexityLoading(false);
    }
  };

  const meIsP1 = user?.id === data?.player1.id;
  const me = meIsP1 ? data?.player1 : data?.player2;
  const opp = meIsP1 ? data?.player2 : data?.player1;
  const result =
    data?.match.winner_id === null
      ? "Draw"
      : data?.match.winner_id === user?.id
      ? "Victory"
      : "Defeat";

  return (
    <main className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-surface to-surface-soft">
        <p className="text-xs uppercase tracking-widest text-muted">Match Debrief</p>
        <h1 className="mt-1 text-3xl font-bold">{data?.problem.title ?? "Loading..."}</h1>
        {data ? (
          <div className="mt-3 flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
              result === "Victory" ? "bg-green-900 text-green-200" : result === "Defeat" ? "bg-red-900 text-red-200" : "bg-yellow-900 text-yellow-200"
            }`}>
              {result.toUpperCase()}
            </span>
            <span className="text-sm text-muted">{data.problem.difficulty}</span>
            {data.problem.topics.map((t) => (
              <span key={t} className="text-xs bg-surface-soft px-2 py-1 rounded">{t}</span>
            ))}
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-400">{error}</p> : null}
      </Card>

      {data ? (
        <section className="grid gap-4 md:grid-cols-2">
          {/* Player Stats */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">You</h2>
                <p className="text-xs text-muted">{me?.username}</p>
              </div>
              <span className="text-2xl font-bold text-primary">{me?.elo_delta && me.elo_delta > 0 ? "+" : ""}{me?.elo_delta ?? 0}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Score:</span>
                <span className="font-semibold">{me?.score ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Solve Time:</span>
                <span className="font-semibold">{formatMs(me?.solve_time_ms ?? null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Submissions:</span>
                <span className="font-semibold">{me?.submission_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Current ELO:</span>
                <span className="font-semibold">{user?.elo ?? 0}</span>
              </div>
            </div>
          </Card>

          {/* Opponent Stats */}
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Opponent</h2>
                <p className="text-xs text-muted">{opp?.username}</p>
              </div>
              <span className="text-2xl font-bold text-red-400">{opp?.elo_delta && opp.elo_delta > 0 ? "+" : ""}{opp?.elo_delta ?? 0}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Score:</span>
                <span className="font-semibold">{opp?.score ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Solve Time:</span>
                <span className="font-semibold">{formatMs(opp?.solve_time_ms ?? null)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Submissions:</span>
                <span className="font-semibold">{opp?.submission_count ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Previous ELO:</span>
                <span className="font-semibold">{opp?.elo ?? 0}</span>
              </div>
            </div>
          </Card>
        </section>
      ) : null}

      {/* Problem Editorial */}
      {data?.problem.editorial && (
        <Card>
          <h2 className="text-lg font-semibold mb-3">Editorial</h2>
          <p className="text-sm whitespace-pre-wrap text-muted">{data.problem.editorial}</p>
        </Card>
      )}

      {/* Complexity Analysis Section */}
      <Card>
        <h2 className="text-lg font-semibold mb-3">Complexity Analysis</h2>
        <p className="text-sm text-muted mb-3">Analyze your winning solution to understand its complexity characteristics.</p>
        {complexity ? (
          <div className="space-y-3 bg-surface-soft p-3 rounded">
            <div>
              <p className="text-xs text-muted mb-1">Time Complexity</p>
              <p className="font-mono text-green-400">{complexity.time}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Space Complexity</p>
              <p className="font-mono text-blue-400">{complexity.space}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Analysis</p>
              <p className="text-sm">{complexity.ai_note}</p>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Explanation</p>
              <p className="text-sm">{complexity.explanation}</p>
            </div>
            <Button onClick={() => setComplexity(null)} size="sm">
              Clear Analysis
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => selectedCode && handleAnalyzeSubmission(selectedCode, "javascript")}
            disabled={complexityLoading || !selectedCode}
            className="bg-purple-700 hover:bg-purple-600"
          >
            {complexityLoading ? "Analyzing..." : "Run Complexity Analysis"}
          </Button>
        )}
      </Card>

      {/* Key Insights */}
      <Card>
        <h2 className="text-lg font-semibold mb-3">Match Insights</h2>
        <div className="space-y-2 text-sm">
          {me && opp && (
            <>
              <div className="flex justify-between p-2 rounded bg-surface-soft">
                <span>Faster Solve:</span>
                <span className="font-semibold">
                  {me.solve_time_ms && opp.solve_time_ms && me.solve_time_ms < opp.solve_time_ms
                    ? `You - ${formatMs(me.solve_time_ms - opp.solve_time_ms)} faster`
                    : me.solve_time_ms && opp.solve_time_ms && opp.solve_time_ms < me.solve_time_ms
                      ? `Opponent - ${formatMs(opp.solve_time_ms - me.solve_time_ms)} faster`
                      : "Equal pace"}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-surface-soft">
                <span>Fewer Attempts:</span>
                <span className="font-semibold">
                  {me.submission_count < opp.submission_count
                    ? `You - ${opp.submission_count - me.submission_count} fewer submissions`
                    : me.submission_count > opp.submission_count
                      ? `Opponent - ${me.submission_count - opp.submission_count} fewer submissions`
                      : "Same attempts"}
                </span>
              </div>
              <div className="flex justify-between p-2 rounded bg-surface-soft">
                <span>ELO Impact:</span>
                <span className={`font-semibold ${me.elo_delta && me.elo_delta > 0 ? "text-green-400" : "text-red-400"}`}>
                  {me.elo_delta && me.elo_delta > 0 ? "+" : ""}{me.elo_delta ?? 0} points
                </span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Link href="/dashboard" className="flex-1 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-center hover:bg-surface-soft transition">
          Back to Dashboard
        </Link>
        <Link href="/leaderboard" className="flex-1 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-center hover:bg-surface-soft transition">
          View Leaderboard
        </Link>
        <Link href="/room/new" className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white text-center hover:bg-primary/80 transition">
          Start New Battle
        </Link>
      </div>
    </main>
  );
}

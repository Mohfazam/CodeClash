"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Match, Problem, Submission } from "@/lib/types";

type MatchDetails = Match & {
  problem: Problem;
  player1: { id: string; username: string; elo: number };
  player2: { id: string; username: string; elo: number };
};

type HintResponse = { hint: string };

function formatTime(ms: number | null): string {
  if (ms === null) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function BattlePage() {
  const params = useParams<{ matchId: string }>();
  const matchId = useMemo(() => String(params.matchId), [params.matchId]);
  const router = useRouter();
  const { token, user } = useAuth();
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [submitStatus, setSubmitStatus] = useState("");
  const [eventStatus, setEventStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [showProblem, setShowProblem] = useState(true);
  const [commentary, setCommentary] = useState<string[]>([]);

  // Load match
  useEffect(() => {
    if (!token) return;
    apiRequest<MatchDetails>({ path: `/api/matches/${matchId}`, token })
      .then((data) => {
        if (data.status !== "active") {
          router.replace(`/matches/${matchId}/debrief`);
          return;
        }
        setMatch(data);
        const starter = data.problem.starterCode?.[language as keyof typeof data.problem.starterCode] || "";
        setCode(starter);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load match"));
  }, [token, matchId, router, language]);

  // Socket listeners
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socket.emit("room:join", { room_code: matchId });

    socket.on("match:timer_tick", ({ remaining_ms }: { remaining_ms: number }) => {
      setRemainingMs(remaining_ms);
    });

    socket.on("match:opponent_typing", () => {
      setEventStatus("Opponent is typing...");
      setTimeout(() => setEventStatus(""), 2000);
    });

    socket.on("match:idle_warning", () => {
      setEventStatus("WARNING: Idle for 45 seconds. 5 lines will be deleted in 10 seconds if you don't resume.");
    });

    socket.on("match:ended", ({ reason }: { reason: string }) => {
      setEventStatus(`Match ended: ${reason}`);
      setTimeout(() => router.push(`/matches/${matchId}/debrief`), 1500);
    });

    return () => {
      socket.emit("room:leave", { room_code: matchId });
      socket.off("match:timer_tick");
      socket.off("match:opponent_typing");
      socket.off("match:idle_warning");
      socket.off("match:ended");
    };
  }, [token, matchId, router]);

  const handleCodeChange = (next: string) => {
    setCode(next);
    if (token) {
      const socket = getSocket(token);
      socket.emit("code:update", { match_id: matchId, code_length: next.length, cursor_line: 0 });
      socket.emit("idle:heartbeat", { match_id: matchId });
    }
  };

  const handleSubmit = async () => {
    if (!token || !match) return;
    setLoading(true);
    setSubmitStatus("Submitting...");
    try {
      const result = await apiRequest<Submission>({
        path: "/api/submissions",
        method: "POST",
        token,
        body: { matchId, code, language },
      });
      setSubmissions([...submissions, result]);
      if (result.verdict === "accepted") {
        setSubmitStatus(`ACCEPTED - ${result.testCasesPassed}/${result.testCasesTotal} test cases passed`);
        setEventStatus("You solved it! Waiting for opponent or time limit...");
        setCommentary([...commentary, `Excellent! Submission accepted with ${result.testCasesPassed}/${result.testCasesTotal} test cases passing.`]);
      } else {
        setSubmitStatus(`FAILED - ${result.verdict.toUpperCase()} (${result.testCasesPassed}/${result.testCasesTotal})`);
        const verdictMsg = result.verdict === "wrong_answer" 
          ? "Your logic needs adjustment. Review the problem constraints."
          : result.verdict === "time_limit_exceeded"
            ? "Your solution is too slow. Consider optimizing the algorithm."
            : "There's a runtime error in your code. Debug and try again.";
        setCommentary([...commentary, verdictMsg]);
      }
    } catch (err) {
      setSubmitStatus("");
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  const handleHint = async () => {
    if (!token || !match) return;
    setHintLoading(true);
    try {
      const result = await apiRequest<HintResponse>({
        path: "/api/ai/hint",
        method: "POST",
        token,
        body: {
          problem_title: match.problem.title,
          problem_description: match.problem.description,
          current_code: code,
          difficulty: match.problem.difficulty,
          topics: match.problem.topics,
        },
      });
      setHint(result.hint);
      setShowHint(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get hint");
    } finally {
      setHintLoading(false);
    }
  };

  const handleSurrender = async () => {
    if (!token) return;
    if (!confirm("Surrender this match? You will lose this battle.")) return;
    setLoading(true);
    try {
      await apiRequest({ path: `/api/matches/${matchId}/surrender`, method: "POST", token });
      setEventStatus("You surrendered.");
      setTimeout(() => router.push(`/matches/${matchId}/debrief`), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Surrender failed");
    } finally {
      setLoading(false);
    }
  };

  if (!match) {
    return (
      <main className="flex items-center justify-center py-20">
        <p className="text-muted">Loading match...</p>
      </main>
    );
  }

  const isCurrentUserPlayer1 = user?.id === match.player1Id;
  const opponent = isCurrentUserPlayer1 ? match.player2 : match.player1;
  const timerClass = remainingMs !== null && remainingMs < 60000 ? "text-red-500" : remainingMs !== null && remainingMs < 300000 ? "text-yellow-500" : "text-foreground";

  return (
    <main className="h-screen flex flex-col bg-surface pb-0">
      {/* Header */}
      <div className="border-b border-border bg-surface-soft p-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-bold">{match.problem.title}</h1>
          <p className="text-xs text-muted mt-1">
            {match.problem.difficulty.toUpperCase()} | {match.problem.topics.join(", ")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {submitStatus && (
            <div className={`text-xs px-2 py-1 rounded ${submitStatus.includes("ACCEPTED") ? "bg-green-900 text-green-200" : "bg-red-900 text-red-200"}`}>
              {submitStatus}
            </div>
          )}
          <div className="text-right">
            <p className="text-xs text-muted">Time Remaining</p>
            <p className={`text-2xl font-bold font-mono ${timerClass}`}>{formatTime(remainingMs)}</p>
          </div>
        </div>
      </div>

      {/* Error & Event Alerts */}
      {error && <div className="bg-red-950 border-b border-red-800 px-3 py-2 text-xs text-red-200">{error}</div>}
      {eventStatus && <div className="bg-blue-950 border-b border-blue-800 px-3 py-2 text-xs text-blue-200">{eventStatus}</div>}

      {/* Main Editor Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Code Editor - Takes 70% */}
        <div className="flex-1 flex flex-col bg-surface border-r border-border">
          {/* Language & Actions Bar */}
          <div className="border-b border-border p-3 bg-surface-soft flex items-center gap-2 justify-between">
            <div className="flex gap-2">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="text-xs rounded border border-border bg-surface px-2 py-1 outline-none"
              >
                {match.problem.starterCode && Object.keys(match.problem.starterCode).map((lang) => (
                  <option key={lang} value={lang}>{lang}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleHint}
                disabled={hintLoading}
                className="text-xs bg-blue-700 hover:bg-blue-600 h-8 px-2"
              >
                {hintLoading ? "Loading..." : "Get Hint"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="text-xs bg-green-700 hover:bg-green-600 h-8 px-2"
              >
                {loading ? "Submitting..." : "Submit"}
              </Button>
              <Button
                onClick={handleSurrender}
                disabled={loading}
                variant="outline"
                className="text-xs text-red-400 border-red-600 h-8 px-2"
              >
                Surrender
              </Button>
            </div>
          </div>

          {/* Code Editor */}
          <textarea
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="flex-1 rounded-none border-none bg-[#090b10] px-4 py-2 font-mono text-sm text-foreground outline-none resize-none"
            placeholder="Write your solution here..."
            spellCheck="false"
          />

          {/* Submissions History */}
          {submissions.length > 0 && (
            <div className="border-t border-border bg-surface-soft p-3 max-h-24 overflow-y-auto">
              <p className="text-xs font-semibold mb-2">Submissions ({submissions.length})</p>
              <div className="space-y-1">
                {submissions.map((sub, i) => (
                  <div key={sub.id} className="text-xs">
                    <span className="font-mono">#{i + 1}</span> - 
                    <span className={`ml-1 ${sub.verdict === "accepted" ? "text-green-400" : "text-red-400"}`}>
                      {sub.verdict.toUpperCase()}
                    </span>
                    <span className="text-muted ml-1">({sub.testCasesPassed}/{sub.testCasesTotal})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Problem Panel - Takes 30%, Collapsible */}
        <div className={`border-l border-border flex flex-col transition-all ${showProblem ? "w-96" : "w-12"}`}>
          {/* Toggle Button */}
          <button
            onClick={() => setShowProblem(!showProblem)}
            className="flex-shrink-0 border-b border-border p-2 bg-surface-soft text-xs font-semibold hover:bg-surface"
          >
            {showProblem ? "Hide" : "Show"} Problem
          </button>

          {/* Problem Content */}
          {showProblem && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">Description</h3>
                <p className="text-xs text-muted whitespace-pre-wrap">{match.problem.description}</p>
              </div>

              {match.problem.constraints && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Constraints</h3>
                  <p className="text-xs text-muted whitespace-pre-wrap">{match.problem.constraints}</p>
                </div>
              )}

              {match.problem.examples && match.problem.examples.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Examples</h3>
                  <div className="space-y-2">
                    {match.problem.examples.map((ex, i) => (
                      <div key={i} className="rounded border border-border bg-surface-soft p-2 text-xs">
                        <p className="font-mono text-muted">Input: {ex.input}</p>
                        <p className="font-mono text-muted">Output: {ex.output}</p>
                        {ex.explanation && <p className="text-muted mt-1">{ex.explanation}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm mb-2">Opponent</h3>
                <p className="text-xs font-semibold">{opponent.username}</p>
                <p className="text-xs text-muted">ELO {opponent.elo}</p>
              </div>

              {commentary.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Live Commentary</h3>
                  <div className="space-y-1 text-xs text-muted">
                    {commentary.map((comment, i) => (
                      <p key={i} className="italic">{comment}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hint Modal */}
      {showHint && hint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="max-w-md mx-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Hint</h3>
              <button onClick={() => setShowHint(false)} className="text-muted hover:text-foreground">
                X
              </button>
            </div>
            <p className="text-sm mb-4">{hint}</p>
            <Button onClick={() => setShowHint(false)} className="w-full">
              Got it
            </Button>
          </Card>
        </div>
      )}
    </main>
  );
}

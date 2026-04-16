"use client";

import { useEffect, useMemo, useState, useRef } from "react";
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

type MatchEvent = {
  id: string;
  type: "submission" | "hint" | "typing" | "commentary" | "status";
  user: string;
  message: string;
  timestamp: number;
  verdict?: string;
  color?: string;
};

function formatTime(ms: number | null): string {
  if (ms === null || ms === undefined) return "00:00";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function BattlePage() {
  const params = useParams<{ matchId: string }>();
  const matchId = useMemo(() => String(params.matchId), [params.matchId]);
  const router = useRouter();
  const { token, user } = useAuth();

  // Match & Code State
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState("");

  // Game Data
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [commentary, setCommentary] = useState<MatchEvent[]>([]);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);
  const [idleWarning, setIdleWarning] = useState<{ seconds_idle: number; seconds_until_delete: number } | null>(null);
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [opponentSubmissions, setOpponentSubmissions] = useState(0);

  // UI Refs
  const eventsFeedRef = useRef<HTMLDivElement>(null);
  const commentaryRef = useRef<HTMLDivElement>(null);

  // Load match on mount
  useEffect(() => {
    const loadMatch = async () => {
      if (!token) return;
      try {
        const data = await apiRequest<MatchDetails>({
          path: `/api/matches/${matchId}`,
          method: "GET",
          token,
        });
        
        if (!data || !data.problem) {
          throw new Error("Invalid match data");
        }
        
        setMatch(data);
        
        // Correctly access starterCode from the API response
        const starterCodeMap = data.problem.starterCode || {};
        const defaultCode = starterCodeMap[language as keyof typeof starterCodeMap] || `// Starter code for ${language}`;
        setCode(defaultCode);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load match");
      } finally {
        setLoading(false);
      }
    };

    if (token) loadMatch();
  }, [token, matchId]);

  // Initialize timer and remaining time
  useEffect(() => {
    if (!match?.startedAt) return;

    const updateTimer = () => {
      const elapsed = Date.now() - new Date(match.startedAt).getTime();
      const timeLimitMs = 5 * 60 * 1000; // 5 minutes
      const remaining = Math.max(0, timeLimitMs - elapsed);
      setRemainingMs(remaining);

      // Check if time is up
      if (remaining === 0) {
        setMatchEvents((prev) => [
          ...prev,
          {
            id: `timeout-${Date.now()}`,
            type: "status",
            user: "System",
            message: "Time limit reached!",
            timestamp: Date.now(),
            color: "text-red-400",
          },
        ]);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [match?.startedAt]);

  // Socket.IO listeners for real-time updates
  useEffect(() => {
    if (!token || !matchId) return;

    const socket = getSocket(token);

    // For direct battle page access, join as spectator to listen to match events
    socket.emit("spectator:join", { match_id: matchId });

    // Timer updates from server
    const handleTimerTick = (data: { remaining_ms: number }) => {
      setRemainingMs(data.remaining_ms);
    };

    // AI Commentary
    const handleAiComment = (data: { comment: string; timestamp: number }) => {
      const commentEvent: MatchEvent = {
        id: `comment-${Date.now()}`,
        type: "commentary",
        user: "AI Commentator",
        message: data.comment,
        timestamp: data.timestamp,
        color: "text-cyan-400",
      };
      setCommentary((prev) => [...prev, commentEvent]);
      setMatchEvents((prev) => [...prev, commentEvent]);
    };

    // Opponent typing indicator
    const handleOpponentTyping = () => {
      setOpponentTyping(true);
      setTimeout(() => setOpponentTyping(false), 1500);
    };

    // Idle warning
    const handleIdleWarning = (data: { seconds_idle: number; seconds_until_delete: number }) => {
      setIdleWarning(data);
      setMatchEvents((prev) => [
        ...prev,
        {
          id: `idle-${Date.now()}`,
          type: "status",
          user: "System",
          message: `Your code will lose ${5 - (data.seconds_until_delete || 0)} lines!`,
          timestamp: Date.now(),
          color: "text-red-500",
        },
      ]);
      if (data.seconds_until_delete > 0) {
        setTimeout(() => setIdleWarning(null), data.seconds_until_delete * 1000 + 500);
      }
    };

    // Match ended
    const handleMatchEnded = (data: { winner_id: string; reason: string }) => {
      setMatchEvents((prev) => [
        ...prev,
        {
          id: `ended-${Date.now()}`,
          type: "status",
          user: "System",
          message: `Match ended - ${data.reason}`,
          timestamp: Date.now(),
          color: data.winner_id === user?.id ? "text-green-400" : "text-red-400",
        },
      ]);
      setTimeout(() => router.push(`/matches/${matchId}/debrief`), 2000);
    };

    // Register listeners
    socket.on("match:timer_tick", handleTimerTick);
    socket.on("match:ai_comment", handleAiComment);
    socket.on("match:opponent_typing", handleOpponentTyping);
    socket.on("match:idle_warning", handleIdleWarning);
    socket.on("match:ended", handleMatchEnded);

    return () => {
      socket.off("match:timer_tick", handleTimerTick);
      socket.off("match:ai_comment", handleAiComment);
      socket.off("match:opponent_typing", handleOpponentTyping);
      socket.off("match:idle_warning", handleIdleWarning);
      socket.off("match:ended", handleMatchEnded);
    };
  }, [token, matchId, user?.id, router]);

  // Auto-scroll events feed
  useEffect(() => {
    if (eventsFeedRef.current) {
      requestAnimationFrame(() => {
        eventsFeedRef.current!.scrollTop = eventsFeedRef.current!.scrollHeight;
      });
    }
  }, [matchEvents]);

  // Auto-scroll commentary
  useEffect(() => {
    if (commentaryRef.current) {
      requestAnimationFrame(() => {
        commentaryRef.current!.scrollTop = commentaryRef.current!.scrollHeight;
      });
    }
  }, [commentary]);

  // Handle submit
  const handleSubmit = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setSubmitStatus("Submitting...");

      const result = await apiRequest<Submission>({
        path: `/api/submissions`,
        method: "POST",
        token,
        body: { matchId, code, language },
      });

      setSubmitStatus(`${result.verdict.toUpperCase()}`);
      setSubmissions((prev) => [...prev, result]);

      // Add to events
      const verdictColor =
        result.verdict === "accepted"
          ? "text-green-400"
          : result.verdict === "runtime_error"
            ? "text-orange-400"
            : "text-red-400";

      setMatchEvents((prev) => [
        ...prev,
        {
          id: result.id,
          type: "submission",
          user: user.username,
          message: `${result.verdict.toUpperCase()} - ${result.testCasesPassed}/${result.testCasesTotal}`,
          timestamp: Date.now(),
          verdict: result.verdict,
          color: verdictColor,
        },
      ]);

      // Stop idle timer
      if (token) {
        getSocket(token).emit("idle:heartbeat", { match_id: matchId });
      }
    } catch (err) {
      setSubmitStatus("ERROR");
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  // Handle hint
  const handleHint = async () => {
    if (!user || !match) return;
    try {
      setHintLoading(true);

      const result = await apiRequest<HintResponse>({
        path: `/api/ai/hint`,
        method: "POST",
        token,
        body: { 
          problemSlug: match.problem.slug,
          currentCode: code,
          language 
        },
      });

      setHint(result.hint);
      setShowHint(true);

      setMatchEvents((prev) => [
        ...prev,
        {
          id: `hint-${Date.now()}`,
          type: "hint",
          user: user.username,
          message: "Requested a hint",
          timestamp: Date.now(),
          color: "text-yellow-400",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get hint");
    } finally {
      setHintLoading(false);
    }
  };

  // Handle surrender
  const handleSurrender = async () => {
    if (!confirm("Surrender? You will lose this match.")) return;

    try {
      setLoading(true);
      await apiRequest({
        path: `/api/matches/${matchId}/surrender`,
        method: "POST",
        token,
      });
      router.push(`/debrief/${matchId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Surrender failed");
    } finally {
      setLoading(false);
    }
  };

  // Handle code change
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (token) {
      const socket = getSocket(token);
      socket.emit("idle:heartbeat", { match_id: matchId });
    }
  };

  if (loading && !match) {
    return (
      <main className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="inline-block mb-4 animate-spin text-2xl">⚙</div>
          <p className="text-gray-300">Loading battle arena...</p>
        </div>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="h-screen flex items-center justify-center bg-red-950">
        <div className="text-center">
          <h1 className="text-xl font-bold text-red-200 mb-2">Match Not Found</h1>
          <p className="text-red-300 mb-4">Unable to load your battle. Redirecting...</p>
          <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
        </div>
      </main>
    );
  }

  const isCurrentUserPlayer1 = user?.id === match.player1.id;
  const opponent = isCurrentUserPlayer1 ? match.player2 : match.player1;
  const timeCritical = remainingMs !== null && remainingMs < 60000;
  const timeVeryLow = remainingMs !== null && remainingMs < 30000;

  return (
    <main className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-gray-200">
      {/* Top Bar - Mission Critical Info */}
      <div className="border-b border-slate-700 bg-slate-800/80 backdrop-blur p-3 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-white truncate">{match.problem.title}</h1>
          <p className="text-xs text-gray-400 mt-1">
            {match.problem.difficulty?.toUpperCase()} | {match.problem.topics?.join(", ") || "No topics"}
          </p>
        </div>

        {/* Timer - LARGE & PROMINENT */}
        <div className="flex items-center gap-8">
          {/* Timer Display */}
          <div className="text-right">
            <p className="text-xs text-gray-400 font-medium">TIME REMAINING</p>
            <p
              className={`text-4xl font-mono font-black tracking-wider transition-all ${
                timeVeryLow
                  ? "text-red-500 animate-pulse drop-shadow-lg"
                  : timeCritical
                    ? "text-yellow-400 drop-shadow-lg"
                    : "text-emerald-400"
              }`}
            >
              {formatTime(remainingMs)}
            </p>
          </div>

          {/* Submit Status Badge */}
          {submitStatus && (
            <div
              className={`px-3 py-2 rounded-lg text-xs font-bold ${
                submitStatus.includes("ACCEPTED")
                  ? "bg-green-900/50 text-green-300 border border-green-600"
                  : submitStatus.includes("ERROR")
                    ? "bg-red-900/50 text-red-300 border border-red-600"
                    : "bg-yellow-900/50 text-yellow-300 border border-yellow-600"
              }`}
            >
              {submitStatus}
            </div>
          )}
        </div>
      </div>

      {/* Alert Bar */}
      {idleWarning && (
        <div className="bg-red-900/60 border-b-2 border-red-500 px-4 py-3 text-sm font-bold text-red-200 flex items-center justify-between animate-pulse">
          <span>IDLE WARNING - 5 LINES WILL BE DELETED</span>
          <span className="bg-red-700 px-3 py-1 rounded text-red-100">{idleWarning.seconds_until_delete}s</span>
        </div>
      )}

      {error && (
        <div className="bg-red-950/80 border-b border-red-700 px-4 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {/* Main Content Grid */}
      <div className="flex-1 flex overflow-hidden gap-2 p-2">
        {/* Left: Code Editor (60%) */}
        <div className="flex-1 flex flex-col bg-slate-950/80 rounded-lg border border-slate-700 overflow-hidden">
          {/* Editor Toolbar */}
          <div className="border-b border-slate-700 bg-slate-800/60 p-2 flex items-center justify-between gap-2">
            <select
              value={language}
              onChange={(e) => {
                const newLang = e.target.value;
                setLanguage(newLang);
                // Update code when language changes
                if (match?.problem?.starterCode) {
                  const starterCodeMap = match.problem.starterCode as Record<string, string>;
                  const newCode = starterCodeMap[newLang] || `// Starter code for ${newLang}`;
                  setCode(newCode);
                }
              }}
              className="text-xs px-2 py-1 rounded bg-slate-700 border border-slate-600 text-gray-200 outline-none hover:border-slate-500"
            >
              {match?.problem?.starterCode &&
                Object.keys(match.problem.starterCode).map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
            </select>

            <div className="flex gap-1 ml-auto">
              <Button
                onClick={handleHint}
                disabled={hintLoading}
                className="text-xs h-7 px-2 bg-blue-700/80 hover:bg-blue-600 text-white border-0"
              >
                {hintLoading ? "..." : "Hint"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="text-xs h-7 px-3 bg-green-600/80 hover:bg-green-500 text-white border-0 font-bold"
              >
                {loading ? "WAIT..." : "SUBMIT"}
              </Button>
              <Button
                onClick={handleSurrender}
                className="text-xs h-7 px-2 bg-red-700/60 hover:bg-red-600 text-red-200 border border-red-600"
              >
                Surrender
              </Button>
            </div>
          </div>

          {/* Code Editor */}
          <textarea
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="flex-1 px-4 py-3 font-mono text-sm bg-slate-950 text-gray-100 outline-none resize-none border-0"
            placeholder="Write your solution here..."
            spellCheck="false"
          />

          {/* Submissions History */}
          {submissions.length > 0 && (
            <div className="border-t border-slate-700 bg-slate-800/40 p-2 max-h-20 overflow-y-auto">
              <p className="text-xs font-bold text-gray-300 mb-1">Submissions ({submissions.length})</p>
              <div className="grid grid-cols-2 gap-1">
                {submissions.slice(-4).map((sub, i) => (
                  <div
                    key={sub.id}
                    className={`text-xs px-2 py-1 rounded font-mono ${
                      sub.verdict === "accepted"
                        ? "bg-green-900/40 text-green-300"
                        : sub.verdict === "runtime_error"
                          ? "bg-orange-900/40 text-orange-300"
                          : "bg-red-900/40 text-red-300"
                    }`}
                  >
                    #{i + 1} {sub.verdict[0].toUpperCase()} {sub.testCasesPassed}/{sub.testCasesTotal}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Problem + Commentary + Events (40%) */}
        <div className="w-2/5 flex flex-col gap-2 overflow-hidden">
          {/* Problem Card */}
          <div className="flex-1 bg-slate-950/80 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
            <div className="border-b border-slate-700 bg-slate-800/60 p-2">
              <h3 className="text-sm font-bold text-white">Problem</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
              <div>
                <p className="text-gray-300 font-semibold mb-1">Description</p>
                <p className="text-gray-400 whitespace-pre-wrap leading-relaxed">{match.problem.description}</p>
              </div>

              {match.problem.constraints && (
                <div>
                  <p className="text-gray-300 font-semibold mb-1">Constraints</p>
                  <p className="text-gray-400 whitespace-pre-wrap">{match.problem.constraints}</p>
                </div>
              )}

              {match.problem.examples && match.problem.examples.length > 0 && (
                <div>
                  <p className="text-gray-300 font-semibold mb-1">Examples</p>
                  {match.problem.examples.slice(0, 2).map((ex, i) => (
                    <div key={i} className="bg-slate-800/40 p-2 rounded mb-1 font-mono text-gray-400 border border-slate-700">
                      <p>Input: {ex.input}</p>
                      <p>Output: {ex.output}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live Commentary Card */}
          <div className="h-48 bg-slate-950/80 rounded-lg border border-cyan-700/40 overflow-hidden flex flex-col">
            <div className="border-b border-cyan-700/40 bg-slate-800/60 p-2">
              <h3 className="text-sm font-bold text-cyan-300">Live Commentary</h3>
            </div>
            <div ref={commentaryRef} className="flex-1 overflow-y-auto p-2 space-y-2 text-xs">
              {commentary.length === 0 ? (
                <p className="text-gray-500 italic">Waiting for your submission...</p>
              ) : (
                commentary.map((event) => (
                  <div key={event.id} className="text-gray-300 border-l-2 border-cyan-600/30 pl-2 py-1">
                    <p className="text-cyan-400 font-semibold">AI</p>
                    <p className="text-gray-300">{event.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Opponent Info + Events Feed */}
          <div className="h-32 bg-slate-950/80 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
            <div className="border-b border-slate-700 bg-slate-800/60 p-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Opponent</h3>
              {opponentTyping && <span className="text-xs text-yellow-400 animate-pulse">Typing...</span>}
            </div>
            <div className="p-3 flex-1 overflow-y-auto text-xs space-y-2">
              <div>
                <p className="text-gray-400">Name</p>
                <p className="text-white font-bold">{opponent.username}</p>
              </div>
              <div>
                <p className="text-gray-400">Rating</p>
                <p className="text-amber-400 font-bold">{opponent.elo}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hint Modal */}
      {showHint && hint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="max-w-xl mx-4 bg-slate-800 border-slate-700">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg text-white">Hint</h3>
                <button
                  onClick={() => setShowHint(false)}
                  className="text-gray-400 hover:text-white text-xl leading-none"
                >
                  ×
                </button>
              </div>
              <p className="text-sm text-gray-300 mb-4">{hint}</p>
              <Button onClick={() => setShowHint(false)} className="w-full bg-blue-600 hover:bg-blue-500">
                Got It
              </Button>
            </div>
          </Card>
        </div>
      )}
    </main>
  );
}


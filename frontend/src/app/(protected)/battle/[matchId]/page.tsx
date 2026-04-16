"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  type: "submission" | "hint" | "typing" | "commentary" | "status" | "opponent";
  user: string;
  message: string;
  timestamp: number;
  verdict?: string;
  color?: string;
};

type MatchEndData = {
  winner_id: string | null;
  reason: "accepted" | "surrender" | "time_up";
  elo_deltas: Record<string, number>;
};

function formatTime(ms: number | null): string {
  if (ms === null || ms === undefined) return "--:--";
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
  const timeLimitMsRef = useRef<number>(30 * 60 * 1000);

  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitStatus, setSubmitStatus] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hint, setHint] = useState("");
  const [surrenderConfirm, setSurrenderConfirm] = useState(false);

  // Match-End State
  const [matchEnded, setMatchEnded] = useState<MatchEndData | null>(null);

  // Opponent State
  const [opponentTyping, setOpponentTyping] = useState(false);
  const [opponentSolvedAlert, setOpponentSolvedAlert] = useState(false);
  const [opponentSurrendered, setOpponentSurrendered] = useState(false);
  const [opponentSubmissionCount, setOpponentSubmissionCount] = useState(0);

  // Idle Warning
  const [idleWarning, setIdleWarning] = useState<{ seconds_idle: number; seconds_until_delete: number } | null>(null);

  // Game Data
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [commentary, setCommentary] = useState<MatchEvent[]>([]);
  const [matchEvents, setMatchEvents] = useState<MatchEvent[]>([]);

  // UI Refs
  const commentaryRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<string>("");

  // Keep codeRef in sync
  useEffect(() => { codeRef.current = code; }, [code]);

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

        if (!data || !data.problem) throw new Error("Invalid match data");

        // Check if match is already over
        if (data.status === "finished" || data.status === "abandoned") {
          router.replace(`/matches/${matchId}/debrief`);
          return;
        }

        setMatch(data);
        const starterCodeMap = data.problem.starterCode || {};
        const defaultCode = starterCodeMap[language as keyof typeof starterCodeMap] || `// Write your solution here\n`;
        setCode(defaultCode);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load match");
      } finally {
        setLoading(false);
      }
    };

    if (token) loadMatch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, matchId]);

  // Socket.IO — join match room & listen to all events
  useEffect(() => {
    if (!token || !matchId) return;

    const socket = getSocket(token);

    // Join the match's socket room (required to receive match events)
    socket.emit("room:join", { room_code: matchId });

    // Timer
    const handleTimerTick = (data: { remaining_ms: number }) => {
      setRemainingMs(data.remaining_ms);
    };

    // AI Commentary
    const handleAiComment = (data: { comment: string; timestamp: number }) => {
      const commentEvent: MatchEvent = {
        id: `comment-${Date.now()}-${Math.random()}`,
        type: "commentary",
        user: "🤖 AI Commentator",
        message: data.comment,
        timestamp: data.timestamp ?? Date.now(),
        color: "text-cyan-400",
      };
      setCommentary((prev) => [...prev.slice(-19), commentEvent]);
      setMatchEvents((prev) => [...prev, commentEvent]);
    };

    // Opponent typing
    const handleOpponentTyping = () => {
      setOpponentTyping(true);
      setTimeout(() => setOpponentTyping(false), 2000);
    };

    // Idle warning
    const handleIdleWarning = (data: { seconds_idle: number; seconds_until_delete: number }) => {
      setIdleWarning(data);
      setMatchEvents((prev) => [
        ...prev,
        {
          id: `idle-${Date.now()}`,
          type: "status",
          user: "⚠️ System",
          message: `IDLE WARNING — 5 lines will be deleted in ${data.seconds_until_delete}s!`,
          timestamp: Date.now(),
          color: "text-red-400",
        },
      ]);
      setTimeout(() => setIdleWarning(null), (data.seconds_until_delete + 1) * 1000);
    };

    // Lines actually deleted (dead man's switch triggered)
    const handleLinesDeleted = (data: { user_id: string; lines_deleted: number }) => {
      if (data.user_id === user?.id) {
        setCode((prev) => {
          const lines = prev.split("\n");
          const removed = lines.slice(0, lines.length - data.lines_deleted);
          return removed.join("\n");
        });
        setMatchEvents((prev) => [
          ...prev,
          {
            id: `lines-${Date.now()}`,
            type: "status",
            user: "⚠️ System",
            message: `${data.lines_deleted} lines deleted (idle penalty)`,
            timestamp: Date.now(),
            color: "text-orange-400",
          },
        ]);
      }
    };

    // Opponent submitted (broadcast to room)
    const handleSubmissionResult = (data: {
      user_id: string;
      verdict: string;
      test_cases_passed: number;
      test_cases_total: number;
      runtime_ms: number;
    }) => {
      if (data.user_id === user?.id) return; // own submission already handled
      setOpponentSubmissionCount((c) => c + 1);
      const verdictColor =
        data.verdict === "accepted" ? "text-green-400" :
        data.verdict === "runtime_error" ? "text-orange-400" : "text-red-400";
      setMatchEvents((prev) => [
        ...prev,
        {
          id: `opp-sub-${Date.now()}`,
          type: "opponent",
          user: "👾 Opponent",
          message: `Submitted: ${data.verdict.toUpperCase()} (${data.test_cases_passed}/${data.test_cases_total} tests)`,
          timestamp: Date.now(),
          color: verdictColor,
        },
      ]);
    };

    // Opponent solved the problem
    const handleOpponentAccepted = (data: { user_id: string }) => {
      if (data.user_id === user?.id) return;
      setOpponentSolvedAlert(true);
      setMatchEvents((prev) => [
        ...prev,
        {
          id: `opp-accepted-${Date.now()}`,
          type: "opponent",
          user: "👾 Opponent",
          message: "Opponent SOLVED the problem! Hurry up!",
          timestamp: Date.now(),
          color: "text-red-300",
        },
      ]);
    };

    // Opponent surrendered
    const handleOpponentSurrendered = (data: { user_id: string }) => {
      if (data.user_id === user?.id) return;
      setOpponentSurrendered(true);
      setMatchEvents((prev) => [
        ...prev,
        {
          id: `opp-surrender-${Date.now()}`,
          type: "status",
          user: "🏳️ System",
          message: "Opponent surrendered! You win!",
          timestamp: Date.now(),
          color: "text-green-400",
        },
      ]);
    };

    // Match ended (server-side timer or acceptance)
    const handleMatchEnded = (data: MatchEndData) => {
      setMatchEnded(data);
      const isWinner = data.winner_id === user?.id;
      setMatchEvents((prev) => [
        ...prev,
        {
          id: `ended-${Date.now()}`,
          type: "status",
          user: "🏁 System",
          message: `Match ended (${data.reason}) — ${isWinner ? "YOU WIN! 🏆" : data.winner_id ? "You lost." : "Draw."}`,
          timestamp: Date.now(),
          color: isWinner ? "text-green-400" : "text-red-400",
        },
      ]);
      // Redirect after a moment to let the user see the result
      setTimeout(() => router.push(`/matches/${matchId}/debrief`), 3500);
    };

    socket.on("match:timer_tick", handleTimerTick);
    socket.on("match:ai_comment", handleAiComment);
    socket.on("match:opponent_typing", handleOpponentTyping);
    socket.on("match:idle_warning", handleIdleWarning);
    socket.on("match:lines_deleted", handleLinesDeleted);
    socket.on("match:submission_result", handleSubmissionResult);
    socket.on("match:opponent_accepted", handleOpponentAccepted);
    socket.on("match:opponent_surrendered", handleOpponentSurrendered);
    socket.on("match:ended", handleMatchEnded);

    return () => {
      socket.emit("room:leave", { room_code: matchId });
      socket.off("match:timer_tick", handleTimerTick);
      socket.off("match:ai_comment", handleAiComment);
      socket.off("match:opponent_typing", handleOpponentTyping);
      socket.off("match:idle_warning", handleIdleWarning);
      socket.off("match:lines_deleted", handleLinesDeleted);
      socket.off("match:submission_result", handleSubmissionResult);
      socket.off("match:opponent_accepted", handleOpponentAccepted);
      socket.off("match:opponent_surrendered", handleOpponentSurrendered);
      socket.off("match:ended", handleMatchEnded);
    };
  }, [token, matchId, user?.id, router]);

  // Idle heartbeat on code change
  const sendHeartbeat = useCallback(() => {
    if (!token) return;
    getSocket(token).emit("idle:heartbeat", { match_id: matchId });
  }, [token, matchId]);

  // Auto-scroll commentary
  useEffect(() => {
    if (commentaryRef.current) {
      requestAnimationFrame(() => {
        commentaryRef.current!.scrollTop = commentaryRef.current!.scrollHeight;
      });
    }
  }, [commentary]);

  // Handle code change
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    sendHeartbeat();
    // Also emit typing indicator
    if (token) {
      getSocket(token).emit("code:update", {
        match_id: matchId,
        code_length: newCode.length,
        cursor_line: 0,
      });
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!user || !match) return;
    try {
      setLoading(true);
      setSubmitStatus("Submitting...");

      const result = await apiRequest<Submission>({
        path: `/api/submissions`,
        method: "POST",
        token,
        body: { matchId, code, language },
      });

      setSubmitStatus(result.verdict.toUpperCase().replace(/_/g, " "));
      setSubmissions((prev) => [...prev, result]);
      sendHeartbeat();

      const verdictColor =
        result.verdict === "accepted" ? "text-green-400" :
        result.verdict === "runtime_error" ? "text-orange-400" : "text-red-400";

      setMatchEvents((prev) => [
        ...prev,
        {
          id: result.id,
          type: "submission",
          user: user.username,
          message: `${result.verdict.toUpperCase().replace(/_/g, " ")} — ${result.testCasesPassed}/${result.testCasesTotal} tests passed`,
          timestamp: Date.now(),
          verdict: result.verdict,
          color: verdictColor,
        },
      ]);

      if (result.verdict === "accepted") {
        setMatchEnded({ winner_id: user.id, reason: "accepted", elo_deltas: {} });
        setTimeout(() => router.push(`/matches/${matchId}/debrief`), 3500);
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
        body: { problemSlug: match.problem.slug, currentCode: code, language },
      });
      setHint(result.hint);
      setShowHint(true);
      setMatchEvents((prev) => [
        ...prev,
        {
          id: `hint-${Date.now()}`,
          type: "hint",
          user: user.username,
          message: "Used a hint 💡",
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
    if (!surrenderConfirm) { setSurrenderConfirm(true); return; }
    setSurrenderConfirm(false);
    try {
      setLoading(true);
      await apiRequest({
        path: `/api/matches/${matchId}/surrender`,
        method: "POST",
        token,
      });
      // Backend emits match:ended via socket, but also redirect just in case
      router.push(`/matches/${matchId}/debrief`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Surrender failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading && !match) {
    return (
      <main className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-300 text-lg font-semibold">Entering Battle Arena...</p>
        </div>
      </main>
    );
  }

  if (!match && !loading) {
    return (
      <main className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center space-y-4 p-6 rounded-2xl border border-slate-700 bg-slate-800/50">
          <div className="text-5xl">⚔️</div>
          <h1 className="text-2xl font-bold text-white">Match not found</h1>
          <p className="text-gray-400">{error || "Unable to load your battle."}</p>
          <Button onClick={() => router.push("/dashboard")} className="bg-cyan-600 hover:bg-cyan-500">
            Return to Dashboard
          </Button>
        </div>
      </main>
    );
  }

  const isCurrentUserPlayer1 = user?.id === match!.player1.id;
  const opponent = isCurrentUserPlayer1 ? match!.player2 : match!.player1;
  const timeCritical = remainingMs !== null && remainingMs < 60000;
  const timeVeryLow = remainingMs !== null && remainingMs < 30000;
  const blindRating = (match! as any).options?.blind_rating?.enabled;

  const lastVerdict = submissions[submissions.length - 1]?.verdict;
  const submitBgClass =
    lastVerdict === "accepted" ? "bg-green-900/40 border-green-600 text-green-300" :
    lastVerdict === "wrong_answer" ? "bg-red-900/40 border-red-600 text-red-300" :
    lastVerdict === "runtime_error" ? "bg-orange-900/40 border-orange-600 text-orange-300" :
    "bg-yellow-900/40 border-yellow-600 text-yellow-300";

  return (
    <main className="h-screen flex flex-col bg-[#0a0e1a] text-gray-200 overflow-hidden">
      
      {/* ══════ MATCH-END OVERLAY ══════ */}
      {matchEnded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className={`text-center p-10 rounded-3xl border-2 shadow-2xl ${
            matchEnded.winner_id === user?.id
              ? "border-green-500/60 bg-gradient-to-br from-green-950 to-slate-900"
              : matchEnded.winner_id
              ? "border-red-500/60 bg-gradient-to-br from-red-950 to-slate-900"
              : "border-yellow-500/60 bg-gradient-to-br from-yellow-950 to-slate-900"
          }`}>
            <div className="text-7xl mb-4">
              {matchEnded.winner_id === user?.id ? "🏆" : matchEnded.winner_id ? "💀" : "🤝"}
            </div>
            <h2 className="text-4xl font-black mb-2">
              {matchEnded.winner_id === user?.id ? "VICTORY!" : matchEnded.winner_id ? "DEFEAT" : "DRAW"}
            </h2>
            <p className="text-gray-300 text-lg capitalize mb-2">
              Reason: {matchEnded.reason.replace(/_/g, " ")}
            </p>
            {matchEnded.elo_deltas[user?.id ?? ""] !== undefined && (
              <p className={`text-2xl font-bold ${matchEnded.elo_deltas[user?.id ?? ""] >= 0 ? "text-green-400" : "text-red-400"}`}>
                {matchEnded.elo_deltas[user?.id ?? ""] >= 0 ? "+" : ""}{matchEnded.elo_deltas[user?.id ?? ""]} ELO
              </p>
            )}
            <p className="text-gray-500 text-sm mt-3 animate-pulse">Redirecting to debrief...</p>
          </div>
        </div>
      )}

      {/* ══════ OPPONENT SOLVED ALERT ══════ */}
      {opponentSolvedAlert && !matchEnded && (
        <div className="fixed top-4 right-4 z-40 bg-red-900/90 border-2 border-red-500 rounded-xl px-5 py-3 text-red-200 shadow-xl animate-bounce">
          <p className="font-bold text-lg">⚠️ Opponent Solved It!</p>
          <p className="text-sm">You still have time — submit now!</p>
          <button onClick={() => setOpponentSolvedAlert(false)} className="text-xs underline mt-1 opacity-70">Dismiss</button>
        </div>
      )}

      {/* ══════ OPPONENT SURRENDER ALERT ══════ */}
      {opponentSurrendered && !matchEnded && (
        <div className="fixed top-4 right-4 z-40 bg-green-900/90 border-2 border-green-500 rounded-xl px-5 py-3 text-green-200 shadow-xl">
          <p className="font-bold text-lg">🏳️ Opponent Surrendered!</p>
          <p className="text-sm">You win! Redirecting to debrief...</p>
        </div>
      )}

      {/* ══════ TOP BAR ══════ */}
      <div className="border-b border-slate-700/60 bg-slate-900/80 backdrop-blur px-4 py-2 flex items-center justify-between gap-4 shrink-0">
        
        {/* Problem info */}
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-bold text-white truncate">{match!.problem.title}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
              match!.problem.difficulty === "easy" ? "bg-green-900/60 text-green-300" :
              match!.problem.difficulty === "medium" ? "bg-yellow-900/60 text-yellow-300" :
              "bg-red-900/60 text-red-300"
            }`}>
              {match!.problem.difficulty?.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500 truncate">{match!.problem.topics?.join(" · ")}</span>
          </div>
        </div>

        {/* Timer */}
        <div className="text-center shrink-0">
          <p className="text-[10px] text-gray-500 font-medium tracking-widest">TIME</p>
          <p className={`text-3xl font-mono font-black tracking-wider leading-none transition-all ${
            timeVeryLow ? "text-red-500 animate-pulse" :
            timeCritical ? "text-yellow-400" : "text-emerald-400"
          }`}>
            {formatTime(remainingMs)}
          </p>
        </div>

        {/* Submit status badge */}
        {submitStatus && (
          <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border shrink-0 ${submitBgClass}`}>
            {submitStatus}
          </div>
        )}

        {/* Vs section */}
        <div className="flex items-center gap-2 shrink-0 text-sm">
          <span className="text-cyan-400 font-bold">{user?.username}</span>
          <span className="text-gray-500">vs</span>
          <span className="text-purple-400 font-bold">
            {blindRating ? "???" : opponent.username}
            {opponentTyping && <span className="ml-1 text-yellow-300 text-xs animate-pulse">typing…</span>}
          </span>
          {opponentSubmissionCount > 0 && (
            <span className="text-xs bg-slate-700 text-gray-300 px-2 py-0.5 rounded-full">
              opp: {opponentSubmissionCount} sub{opponentSubmissionCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ══════ ALERTS ══════ */}
      {idleWarning && (
        <div className="bg-red-900/70 border-b-2 border-red-500 px-4 py-2 text-sm font-bold text-red-200 flex items-center justify-between animate-pulse shrink-0">
          <span>⚠️ IDLE WARNING — 5 lines delete in {idleWarning.seconds_until_delete}s!</span>
          <span className="bg-red-700 px-3 py-0.5 rounded font-mono">{idleWarning.seconds_until_delete}s</span>
        </div>
      )}
      {error && (
        <div className="bg-red-950/80 border-b border-red-800 px-4 py-1.5 text-xs text-red-300 shrink-0 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-400 hover:text-red-200 ml-2">✕</button>
        </div>
      )}

      {/* ══════ MAIN CONTENT ══════ */}
      <div className="flex-1 flex overflow-hidden gap-2 p-2">

        {/* ── Left: Code Editor ── */}
        <div className="flex-1 flex flex-col bg-slate-950/90 rounded-xl border border-slate-700/60 overflow-hidden shadow-xl">
          
          {/* Editor toolbar */}
          <div className="border-b border-slate-700/60 bg-slate-800/60 px-3 py-2 flex items-center gap-2">
            <select
              value={language}
              onChange={(e) => {
                const newLang = e.target.value;
                setLanguage(newLang);
                if (match!.problem.starterCode) {
                  const starterCodeMap = match!.problem.starterCode as Record<string, string>;
                  setCode(starterCodeMap[newLang] || `// Starter code for ${newLang}\n`);
                }
              }}
              className="text-xs px-2 py-1 rounded-lg bg-slate-700 border border-slate-600 text-gray-200 outline-none hover:border-slate-500 cursor-pointer"
            >
              {match!.problem.starterCode &&
                Object.keys(match!.problem.starterCode).map((lang) => (
                  <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                ))}
            </select>

            <span className="text-xs text-gray-600 ml-1">{code.split("\n").length} lines</span>

            <div className="flex gap-1.5 ml-auto">
              <Button
                onClick={handleHint}
                disabled={hintLoading || !!matchEnded}
                className="text-xs h-7 px-3 bg-blue-700/80 hover:bg-blue-600 text-white border-0"
              >
                {hintLoading ? "..." : "💡 Hint"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !!matchEnded}
                className="text-xs h-7 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white border-0 font-bold shadow-lg"
              >
                {loading ? "Running..." : "▶ Submit"}
              </Button>
              {surrenderConfirm ? (
                <div className="flex gap-1">
                  <Button
                    onClick={handleSurrender}
                    className="text-xs h-7 px-2 bg-red-600 hover:bg-red-500 text-white border-0 animate-pulse"
                  >
                    Confirm?
                  </Button>
                  <Button
                    onClick={() => setSurrenderConfirm(false)}
                    className="text-xs h-7 px-2 bg-slate-600 hover:bg-slate-500 text-white border-0"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleSurrender}
                  disabled={!!matchEnded}
                  className="text-xs h-7 px-2 bg-transparent hover:bg-red-900/40 text-red-400 border border-red-700/50"
                >
                  🏳️ Surrender
                </Button>
              )}
            </div>
          </div>

          {/* Textarea editor */}
          <textarea
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="flex-1 px-4 py-3 font-mono text-sm bg-slate-950 text-gray-100 outline-none resize-none leading-relaxed"
            placeholder="Write your solution here..."
            spellCheck={false}
            readOnly={!!matchEnded}
          />

          {/* Submissions history */}
          {submissions.length > 0 && (
            <div className="border-t border-slate-700/60 bg-slate-900/60 px-3 py-2 max-h-24 overflow-y-auto shrink-0">
              <p className="text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">
                Your Submissions ({submissions.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {submissions.map((sub, i) => (
                  <div
                    key={sub.id}
                    className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                      sub.verdict === "accepted" ? "bg-green-900/50 text-green-300" :
                      sub.verdict === "runtime_error" ? "bg-orange-900/50 text-orange-300" :
                      "bg-red-900/50 text-red-300"
                    }`}
                  >
                    #{i + 1} {sub.testCasesPassed}/{sub.testCasesTotal}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div className="w-[380px] flex flex-col gap-2 overflow-hidden shrink-0">

          {/* Problem Statement */}
          <div className="flex-1 bg-slate-950/90 rounded-xl border border-slate-700/60 overflow-hidden flex flex-col shadow-xl">
            <div className="border-b border-slate-700/60 bg-slate-800/60 px-3 py-2">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">📋 Problem</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3 scrollbar-thin">
              <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{match!.problem.description}</p>

              {match!.problem.constraints && (
                <div>
                  <p className="text-gray-400 font-semibold mb-1">Constraints</p>
                  <p className="text-gray-500 font-mono text-[11px] whitespace-pre-wrap bg-slate-900/60 p-2 rounded">
                    {match!.problem.constraints}
                  </p>
                </div>
              )}

              {match!.problem.examples && match!.problem.examples.length > 0 && (
                <div className="space-y-2">
                  <p className="text-gray-400 font-semibold">Examples</p>
                  {match!.problem.examples.slice(0, 3).map((ex, i) => (
                    <div key={i} className="bg-slate-900/80 p-2 rounded-lg border border-slate-700/40 font-mono text-[11px]">
                      <p className="text-blue-300">Input: <span className="text-gray-300">{ex.input}</span></p>
                      <p className="text-green-300">Output: <span className="text-gray-300">{ex.output}</span></p>
                      {ex.explanation && (
                        <p className="text-gray-500 mt-1">Note: {ex.explanation}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live AI Commentary */}
          <div className="h-44 bg-slate-950/90 rounded-xl border border-cyan-800/30 overflow-hidden flex flex-col shadow-xl">
            <div className="border-b border-cyan-800/30 bg-slate-800/60 px-3 py-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
              <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Live Commentary</h3>
            </div>
            <div ref={commentaryRef} className="flex-1 overflow-y-auto p-2 space-y-2 text-xs scrollbar-thin">
              {commentary.length === 0 ? (
                <p className="text-gray-600 italic pt-2 text-center">
                  🎙️ Submit code to hear the commentator...
                </p>
              ) : (
                commentary.map((event) => (
                  <div key={event.id} className="border-l-2 border-cyan-700/40 pl-2 py-0.5">
                    <p className="text-cyan-500 font-semibold text-[10px]">🤖 AI</p>
                    <p className="text-gray-300 leading-snug">{event.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Events Feed */}
          <div className="h-36 bg-slate-950/90 rounded-xl border border-slate-700/60 overflow-hidden flex flex-col shadow-xl">
            <div className="border-b border-slate-700/60 bg-slate-800/60 px-3 py-2">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">🔔 Events</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs scrollbar-thin">
              {matchEvents.slice(-20).reverse().map((event) => (
                <div key={event.id} className="flex items-start gap-1.5">
                  <span className={`shrink-0 font-medium ${event.color ?? "text-gray-400"}`}>
                    {event.user}:
                  </span>
                  <span className="text-gray-400 leading-snug">{event.message}</span>
                </div>
              ))}
              {matchEvents.length === 0 && (
                <p className="text-gray-600 italic text-center pt-2">No events yet</p>
              )}
            </div>
          </div>

          {/* Opponent card */}
          <div className="bg-slate-950/90 rounded-xl border border-purple-800/30 p-3 shrink-0 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-0.5">Opponent</p>
                <p className="font-bold text-purple-300">{blindRating ? "???" : opponent.username}</p>
              </div>
              <div className="text-right">
                {!blindRating && (
                  <p className="text-amber-400 font-bold text-lg">{opponent.elo}</p>
                )}
                {opponentTyping && (
                  <p className="text-yellow-300 text-xs animate-pulse">typing…</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-2 text-[10px] text-gray-500">
              <span>{opponentSubmissionCount} submission{opponentSubmissionCount !== 1 ? "s" : ""}</span>
              {opponentSolvedAlert && <span className="text-red-400 font-bold">● SOLVED</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ══════ HINT MODAL ══════ */}
      {showHint && hint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="max-w-lg w-full mx-4 bg-slate-800 border-blue-700/50 shadow-2xl">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  💡 Hint
                </h3>
                <button onClick={() => setShowHint(false)} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
              </div>
              <div className="bg-blue-950/50 border border-blue-700/30 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-200 leading-relaxed">{hint}</p>
              </div>
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

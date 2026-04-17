"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { getRankTier, Problem } from "@/lib/types";

type DashboardStats = {
  elo: number;
  wins: number;
  losses: number;
  totalMatches: number;
  eloHistory: Array<{ delta: number; oldElo: number; newElo: number; createdAt: string }>;
  topicStats?: Array<{
    topic: string;
    wins: number;
    losses: number;
    avgSolveTimeMs: number | null;
    last5Outcomes: ("W" | "L")[];
  }>;
};

type MatchHistoryEntry = {
  id: string;
  status: string;
  winnerId: string | null;
  startedAt: string;
  endedAt: string | null;
  problem?: { title: string; slug: string; difficulty: string };
  opponent?: { username: string; elo: number };
  result?: string;
  eloDelta?: number | null;
};

function drawSparkline(canvas: HTMLCanvasElement, data: number[], color: string, fillColor: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx || data.length < 2) return;

  const w = canvas.width;
  const h = canvas.height;
  const pad = 4;
  const min = Math.min(...data) - 10;
  const max = Math.max(...data) + 10;
  const range = max - min || 1;

  ctx.clearRect(0, 0, w, h);

  // Fill gradient
  ctx.beginPath();
  data.forEach((val, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = pad + ((max - val) / range) * (h - 2 * pad);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(w - pad, h - pad);
  ctx.lineTo(pad, h - pad);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, fillColor);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  data.forEach((val, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = pad + ((max - val) / range) * (h - 2 * pad);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // End dot
  const lastX = w - pad;
  const lastY = pad + ((max - data[data.length - 1]) / range) * (h - 2 * pad);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawRadar(canvas: HTMLCanvasElement, topics: { topic: string; rate: number }[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx || topics.length < 3) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(cx, cy) - 30;
  const n = topics.length;

  ctx.clearRect(0, 0, w, h);

  // Grid circles
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (r * i) / 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axes
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();

    // Labels
    const lx = cx + Math.cos(angle) * (r + 16);
    const ly = cy + Math.sin(angle) * (r + 16);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(topics[i].topic, lx, ly);
  }

  // Data shape
  ctx.beginPath();
  topics.forEach((t, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const dist = (t.rate / 100) * r;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(124, 58, 237, 0.2)";
  ctx.fill();
  ctx.strokeStyle = "rgba(124, 58, 237, 0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dots
  topics.forEach((t, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const dist = (t.rate / 100) * r;
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#a78bfa";
    ctx.fill();
  });
}

export default function DashboardPage() {
  const { user, token, refreshMe } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyProblem, setDailyProblem] = useState<Problem | null>(null);

  const sparklineRef = useRef<HTMLCanvasElement>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    Promise.all([
      apiRequest<DashboardStats>({ path: "/api/users/me/stats", token }),
      apiRequest<{ matches: MatchHistoryEntry[] }>({ path: "/api/matches/history?limit=5&offset=0", token }),
      apiRequest<{ problems: Problem[] }>({ path: "/api/problems?limit=1&offset=0", token }).catch(() => null),
    ])
      .then(([statsData, historyData, problemsData]) => {
        setStats(statsData);
        setRecentMatches(historyData.matches || []);

        // Pseudo-daily challenge (pick from available problems)
        if (problemsData?.problems?.length) {
          const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
          const problemIndex = dayIndex % problemsData.problems.length;
          setDailyProblem(problemsData.problems[problemIndex]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Draw charts when data loads
  useEffect(() => {
    if (sparklineRef.current && stats?.eloHistory && stats.eloHistory.length >= 2) {
      const canvas = sparklineRef.current;
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(2, 2);

      const eloSeries = [stats.eloHistory[stats.eloHistory.length - 1].oldElo];
      for (let i = stats.eloHistory.length - 1; i >= 0; i--) {
        eloSeries.push(stats.eloHistory[i].newElo);
      }
      drawSparkline(canvas, eloSeries, "#7c3aed", "rgba(124,58,237,0.3)");
    }
  }, [stats]);

  useEffect(() => {
    if (radarRef.current && stats?.topicStats && stats.topicStats.length >= 3) {
      const canvas = radarRef.current;
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(2, 2);

      const radarData = stats.topicStats.map((t) => ({
        topic: t.topic.length > 8 ? t.topic.slice(0, 8) + "…" : t.topic,
        rate: (t.wins + t.losses > 0) ? (t.wins / (t.wins + t.losses)) * 100 : 0,
      }));
      drawRadar(canvas, radarData);
    }
  }, [stats]);

  if (loading) {
    return (
      <main className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted">Loading dashboard...</p>
        </div>
      </main>
    );
  }

  const tier = getRankTier(stats?.elo ?? user?.elo ?? 0);
  const winRate = stats && stats.totalMatches > 0 ? Math.round((stats.wins / stats.totalMatches) * 100) : 0;
  const currentStreak = getStreak(recentMatches, user?.id);

  return (
    <main className="space-y-6">
      {/* ══ Welcome Header ══ */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            Welcome back,{" "}
            <span className={`bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>
              {user?.username}
            </span>
          </h1>
          <p className="text-muted mt-1">Ready for your next battle?</p>
        </div>

        <Link href="/room/new">
          <Button className="px-8 py-3 text-base font-bold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 animate-pulse shadow-lg shadow-cyan-500/20">
            ⚔️ Start Battle
          </Button>
        </Link>
      </div>

      {/* ══ Hero Stats Row ══ */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {/* Rank Card */}
        <div className={`rounded-2xl border border-slate-700/60 p-5 ${tier.bgColor} flex flex-col items-center justify-center shadow-lg ${tier.glowColor} shadow-xl md:col-span-1`}>
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center shadow-lg mb-3`}>
            <span className="text-3xl text-white font-bold">{tier.icon}</span>
          </div>
          <p className={`font-black text-xl ${tier.textColor}`}>{tier.name}</p>
          <p className="text-muted text-xs mt-0.5">Current Rank</p>
        </div>

        {/* ELO Card */}
        <Card className="flex flex-col">
          <p className="text-xs text-muted uppercase tracking-wider">ELO Rating</p>
          <p className={`text-4xl font-black mt-auto bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>
            {stats?.elo ?? user?.elo ?? 0}
          </p>
          {stats?.eloHistory?.[0] && (
            <p className={`text-xs font-bold mt-1 ${stats.eloHistory[0].delta >= 0 ? "text-green-400" : "text-red-400"}`}>
              {stats.eloHistory[0].delta >= 0 ? "↑" : "↓"} {stats.eloHistory[0].delta >= 0 ? "+" : ""}{stats.eloHistory[0].delta} last match
            </p>
          )}
        </Card>

        {/* Win Rate */}
        <Card className="flex flex-col">
          <p className="text-xs text-muted uppercase tracking-wider">Win Rate</p>
          <p className={`text-4xl font-black mt-auto ${winRate >= 50 ? "text-green-400" : winRate > 30 ? "text-yellow-400" : "text-red-400"}`}>
            {winRate}%
          </p>
          <p className="text-xs text-muted">{stats?.wins ?? 0}W / {stats?.losses ?? 0}L</p>
        </Card>

        {/* Matches Played */}
        <Card className="flex flex-col">
          <p className="text-xs text-muted uppercase tracking-wider">Matches</p>
          <p className="text-4xl font-black mt-auto text-white">{stats?.totalMatches ?? 0}</p>
          <p className="text-xs text-muted">Total battles</p>
        </Card>

        {/* Win Streak */}
        <Card className="flex flex-col">
          <p className="text-xs text-muted uppercase tracking-wider">Streak</p>
          <div className="flex items-end gap-2 mt-auto">
            <p className={`text-4xl font-black ${currentStreak > 0 ? "text-orange-400" : currentStreak < 0 ? "text-red-400" : "text-gray-500"}`}>
              {Math.abs(currentStreak)}
            </p>
            {currentStreak > 0 && (
              <span className="text-2xl animate-bounce">🔥</span>
            )}
          </div>
          <p className="text-xs text-muted">{currentStreak > 0 ? "Win streak" : currentStreak < 0 ? "Loss streak" : "No streak"}</p>
        </Card>
      </section>

      {/* ══ Charts Row ══ */}
      <section className="grid gap-4 md:grid-cols-2">
        {/* ELO Sparkline */}
        <Card>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full" />
            ELO Progression
          </h2>
          <div className="relative" style={{ height: 120 }}>
            <canvas
              ref={sparklineRef}
              className="w-full h-full"
              style={{ width: "100%", height: "100%" }}
            />
            {(!stats?.eloHistory || stats.eloHistory.length < 2) && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                Play more matches to see your ELO chart
              </div>
            )}
          </div>
        </Card>

        {/* Skill Radar */}
        <Card>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-400 rounded-full" />
            Skill Radar
          </h2>
          <div className="relative" style={{ height: 120 }}>
            <canvas
              ref={radarRef}
              className="w-full h-full"
              style={{ width: "100%", height: "100%" }}
            />
            {(!stats?.topicStats || stats.topicStats.length < 3) && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
                Play more to build your skill profile
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* ══ Bottom Row ══ */}
      <section className="grid gap-4 md:grid-cols-3">

        {/* Recent Matches */}
        <div className="md:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Battles</h2>
            <Link href={`/profile/${user?.username}`} className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          {recentMatches.length === 0 ? (
            <Card className="py-6 text-center text-muted">
              <p className="text-lg mb-2">⚔️</p>
              <p>No battles yet. Start your first match!</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentMatches.map((match) => (
                <Link href={`/matches/${match.id}/debrief`} key={match.id}>
                  <Card className="hover:border-primary/30 transition cursor-pointer flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                        match.result === "win" ? "bg-green-900/50 text-green-300" :
                        match.result === "loss" ? "bg-red-900/50 text-red-300" :
                        "bg-yellow-900/50 text-yellow-300"
                      }`}>
                        {match.result === "win" ? "W" : match.result === "loss" ? "L" : "D"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">
                          {match.problem?.title ?? "Unknown Problem"}
                        </p>
                        <p className="text-xs text-muted truncate">
                          vs {match.opponent?.username ?? "Unknown"} ({match.opponent?.elo ?? "?"})
                          {match.problem?.difficulty && (
                            <span className={`ml-2 ${
                              match.problem.difficulty === "easy" ? "text-green-400" :
                              match.problem.difficulty === "medium" ? "text-yellow-400" :
                              "text-red-400"
                            }`}>
                              {match.problem.difficulty}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {match.eloDelta != null && (
                        <p className={`text-sm font-bold ${match.eloDelta >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {match.eloDelta >= 0 ? "+" : ""}{match.eloDelta}
                        </p>
                      )}
                      <p className="text-[10px] text-muted">
                        {new Date(match.startedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Daily Challenge */}
          <Card className="border-amber-700/30 bg-gradient-to-br from-amber-950/20 to-surface">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🎯</span>
              <h2 className="font-semibold">Daily Challenge</h2>
            </div>
            {dailyProblem ? (
              <>
                <p className="font-medium text-white">{dailyProblem.title}</p>
                <div className="flex items-center gap-2 mt-1.5 mb-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    dailyProblem.difficulty === "easy" ? "bg-green-900/60 text-green-300" :
                    dailyProblem.difficulty === "medium" ? "bg-yellow-900/60 text-yellow-300" :
                    "bg-red-900/60 text-red-300"
                  }`}>
                    {dailyProblem.difficulty}
                  </span>
                  <span className="text-xs text-muted">{dailyProblem.topics?.join(", ")}</span>
                </div>
                <Link href={`/problems/${dailyProblem.slug}`}>
                  <Button size="sm" className="w-full bg-amber-700 hover:bg-amber-600">
                    Solve Now →
                  </Button>
                </Link>
              </>
            ) : (
              <p className="text-sm text-muted">No challenges available yet.</p>
            )}
          </Card>

          {/* Quick Actions */}
          <Card>
            <h2 className="font-semibold mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <Link href="/room/new" className="block">
                <Button className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500" size="sm">
                  ⚔️ Create Room
                </Button>
              </Link>
              <Link href="/problems" className="block">
                <Button variant="outline" className="w-full" size="sm">
                  📚 Browse Problems
                </Button>
              </Link>
              <Link href="/leaderboard" className="block">
                <Button variant="outline" className="w-full" size="sm">
                  🏆 Leaderboard
                </Button>
              </Link>
            </div>
          </Card>

          {/* Topic Performance */}
          {stats?.topicStats && stats.topicStats.length > 0 && (
            <Card>
              <h2 className="font-semibold mb-3">Top Topics</h2>
              <div className="space-y-2">
                {stats.topicStats
                  .sort((a, b) => b.wins - a.wins)
                  .slice(0, 4)
                  .map((topic) => (
                    <div key={topic.topic} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-gray-300">{topic.topic}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-green-400">{topic.wins}W</span>
                        <span className="text-xs text-red-400">{topic.losses}L</span>
                        <div className="flex gap-0.5">
                          {(topic.last5Outcomes || []).map((o, i) => (
                            <div
                              key={i}
                              className={`w-3 h-3 rounded-sm ${o === "W" ? "bg-green-600" : "bg-red-600"}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </div>
      </section>
    </main>
  );
}

// Streak calculation
function getStreak(matches: MatchHistoryEntry[], userId?: string): number {
  if (!userId || !matches.length) return 0;
  let streak = 0;
  const sorted = [...matches].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

  const firstResult = sorted[0].result;
  if (!firstResult || firstResult === "draw") return 0;

  for (const m of sorted) {
    if (m.result === firstResult) {
      streak += firstResult === "win" ? 1 : -1;
    } else {
      break;
    }
  }
  return streak;
}

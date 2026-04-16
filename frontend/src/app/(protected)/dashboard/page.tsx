"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";

type Stats = {
  wins: number;
  losses: number;
  totalMatches: number;
  eloHistory: Array<{ delta: number; createdAt: string }>;
};

type MatchHistoryItem = {
  id: string;
  result: "win" | "loss" | "draw";
  eloDelta: number;
  problem: { title: string; difficulty: string };
  opponent: { username: string; elo: number };
};

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiRequest<Stats>({ path: "/api/users/me/stats", token }),
      apiRequest<{ matches: MatchHistoryItem[] }>({ path: "/api/matches/history?limit=6&offset=0", token }),
    ])
      .then(([statsData, historyData]) => {
        setStats(statsData);
        setHistory(historyData.matches);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"));
  }, [token]);

  const winRate = stats && stats.totalMatches > 0 ? ((stats.wins / stats.totalMatches) * 100).toFixed(1) : "0";

  return (
    <main className="space-y-6">
      {/* Welcome Card */}
      <div className="rounded-lg border border-border bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-6">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.username}!</h1>
        <p className="text-muted">Ready for another challenge? Compete and climb the leaderboard.</p>
      </div>

      {/* Stats Section */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <p className="text-xs text-muted mb-2">Current ELO</p>
          <p className="text-3xl font-bold text-primary">{user?.elo ?? 0}</p>
          <p className="text-xs text-muted mt-1">Rating</p>
        </Card>
        <Card>
          <p className="text-xs text-muted mb-2">Wins</p>
          <p className="text-3xl font-bold text-green-400">{stats?.wins ?? 0}</p>
          <p className="text-xs text-muted mt-1">{stats?.totalMatches ?? 0} matches</p>
        </Card>
        <Card>
          <p className="text-xs text-muted mb-2">Losses</p>
          <p className="text-3xl font-bold text-red-400">{stats?.losses ?? 0}</p>
          <p className="text-xs text-muted mt-1">Win rate: {winRate}%</p>
        </Card>
        <Card>
          <p className="text-xs text-muted mb-2">Total Matches</p>
          <p className="text-3xl font-bold">{stats?.totalMatches ?? 0}</p>
          <Link href="/profile/me" className="text-xs text-primary hover:underline mt-1 block">
            View profile →
          </Link>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Battles */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Battles</h2>
            <Link href="/room/new" className="text-sm text-primary hover:underline">
              Start new ↗
            </Link>
          </div>
          {error ? <p className="text-sm text-red-400 mb-3">{error}</p> : null}
          {history.length === 0 ? (
            <p className="text-sm text-muted py-6 text-center">No matches yet. Start your first battle!</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <Link key={item.id} href={`/matches/${item.id}/debrief`}>
                  <div className="rounded-lg border border-border bg-surface-soft p-3 hover:border-primary/50 hover:bg-surface transition cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">{item.problem.title}</p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          item.result === "win"
                            ? "bg-green-900 text-green-200"
                            : item.result === "loss"
                              ? "bg-red-900 text-red-200"
                              : "bg-yellow-900 text-yellow-200"
                        }`}
                      >
                        {item.result.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-muted">
                      vs {item.opponent.username} ({item.opponent.elo} ELO) •{" "}
                      <span className={item.eloDelta > 0 ? "text-green-400" : "text-red-400"}>
                        {item.eloDelta > 0 ? "+" : ""}
                        {item.eloDelta}
                      </span>{" "}
                      • {item.problem.difficulty}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/room/new"
              className="block rounded-lg border border-green-600 bg-green-900/20 px-4 py-3 text-sm font-semibold text-green-300 hover:bg-green-900/30 transition"
            >
              Start Battle
            </Link>
            <Link
              href="/leaderboard"
              className="block rounded-lg border border-blue-600 bg-blue-900/20 px-4 py-3 text-sm font-semibold text-blue-300 hover:bg-blue-900/30 transition"
            >
              View Leaderboard
            </Link>
            <Link
              href="/problems"
              className="block rounded-lg border border-purple-600 bg-purple-900/20 px-4 py-3 text-sm font-semibold text-purple-300 hover:bg-purple-900/30 transition"
            >
              Browse Problems
            </Link>
            <Link
              href={`/profile/${user?.username}`}
              className="block rounded-lg border border-purple-600 bg-purple-900/20 px-4 py-3 text-sm font-semibold text-purple-300 hover:bg-purple-900/30 transition"
            >
              View Profile
            </Link>
          </div>
        </Card>
      </div>

      {/* ELO History Chart */}
      {stats?.eloHistory && stats.eloHistory.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">ELO History (Last 10 Matches)</h2>
          <div className="flex items-flex-end justify-between h-32 gap-2">
            {stats.eloHistory.slice(0, 10).reverse().map((entry, i) => {
              const isWin = entry.delta > 0;
              const maxDelta = Math.max(...stats.eloHistory.map((e) => Math.abs(e.delta)));
              const height = maxDelta > 0 ? (Math.abs(entry.delta) / maxDelta) * 100 : 0;
              return (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-full rounded-t ${isWin ? "bg-green-500" : "bg-red-500"}`}
                    style={{ height: `${height}%`, minHeight: "8px" }}
                    title={`${isWin ? "+" : ""}${entry.delta}`}
                  />
                  <p className="text-xs text-muted mt-2">{i + 1}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </main>
  );
}

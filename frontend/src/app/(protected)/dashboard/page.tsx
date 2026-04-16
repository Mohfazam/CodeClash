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

  return (
    <main className="space-y-5">
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-sm text-muted">Current ELO</p>
          <p className="mt-1 text-2xl font-semibold">{user?.elo ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Wins</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.wins ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Losses</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.losses ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Matches</p>
          <p className="mt-1 text-2xl font-semibold">{stats?.totalMatches ?? 0}</p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent battles</h2>
            <Link href="/room/new" className="text-sm text-primary-soft">
              Start a new duel
            </Link>
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted">No matches yet.</p>
            ) : (
              history.map((item) => (
                <div key={item.id} className="rounded-lg border border-border bg-surface-soft p-3">
                  <p className="font-medium">
                    {item.problem.title} <span className="text-xs text-muted">vs {item.opponent.username}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {item.result.toUpperCase()} | {item.problem.difficulty} | ELO {item.eloDelta > 0 ? "+" : ""}
                    {item.eloDelta}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Quick actions</h2>
          <div className="space-y-2">
            <Link href="/room/new" className="block rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm">
              Create room
            </Link>
            <Link href="/dashboard" className="block rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm">
              Refresh stats
            </Link>
          </div>
        </Card>
      </section>
    </main>
  );
}

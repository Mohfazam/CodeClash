"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";

type LeaderboardEntry = {
  rank: number;
  id: string;
  username: string;
  elo: number;
  metadata?: Record<string, unknown>;
};

type LeaderboardResponse = {
  leaderboard: LeaderboardEntry[];
  limit: number;
  offset: number;
};

export default function LeaderboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiRequest<LeaderboardResponse>({
      path: `/api/leaderboard?limit=${limit}&offset=${offset}`,
      token,
    })
      .then((res) => {
        setData(res.leaderboard);
        // API doesn't return total; estimate from data length
        if (res.leaderboard.length < limit) {
          setTotal(offset + res.leaderboard.length);
        } else {
          setTotal(offset + res.leaderboard.length + 1);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leaderboard"))
      .finally(() => setLoading(false));
  }, [token, limit, offset]);

  const pages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Global Leaderboard</h1>
        <p className="text-sm text-muted">{total} players</p>
      </div>

      {error && <div className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">{error}</div>}

      {loading ? (
        <Card className="py-8 text-center text-muted">Loading leaderboard...</Card>
      ) : data.length === 0 ? (
        <Card className="py-8 text-center text-muted">No entries yet</Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-semibold">Rank</th>
                  <th className="px-4 py-3 text-left font-semibold">Player</th>
                  <th className="px-4 py-3 text-right font-semibold">ELO Rating</th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-surface-soft transition">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm mr-2 ${
                        entry.rank === 1 ? "bg-yellow-500/20 text-yellow-300" :
                        entry.rank === 2 ? "bg-gray-400/20 text-gray-300" :
                        entry.rank === 3 ? "bg-orange-600/20 text-orange-300" :
                        "bg-slate-700/20 text-gray-500"
                      }`}>
                        {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/profile/${entry.username}`} className="text-primary hover:underline font-medium">
                        {entry.username}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-block px-3 py-1 rounded-full bg-primary/20 text-primary font-semibold">
                        {entry.elo}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-4 pt-6">
            <div className="text-sm text-muted">
              Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1 rounded border border-border disabled:opacity-50 hover:bg-surface-soft"
              >
                ← Previous
              </button>
              <span className="text-sm text-muted">
                Page {currentPage} of {pages}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={currentPage >= pages}
                className="px-3 py-1 rounded border border-border disabled:opacity-50 hover:bg-surface-soft"
              >
                Next →
              </button>
            </div>
            <div className="text-sm text-muted">
              Show:
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setOffset(0);
                }}
                className="ml-2 rounded border border-border bg-surface-soft px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

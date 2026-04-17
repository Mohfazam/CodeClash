"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { getRankTier } from "@/lib/types";

type LeaderboardEntry = {
  id: string;
  username: string;
  elo: number;
  wins?: number;
  losses?: number;
  totalMatches?: number;
};

export default function LeaderboardPage() {
  const { token, user } = useAuth();
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiRequest<{ leaderboard: LeaderboardEntry[] }>({ path: "/api/leaderboard", token })
      .then((data) => setPlayers(data.leaderboard))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load leaderboard"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted">Loading leaderboard...</p>
        </div>
      </main>
    );
  }

  const myRank = players.findIndex((p) => p.id === user?.id) + 1;

  return (
    <main className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="text-muted text-sm mt-1">Top competitive coders ranked by ELO</p>
        </div>
        {myRank > 0 && (
          <div className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border border-purple-500/20">
            <p className="text-xs text-muted">Your Rank</p>
            <p className="text-2xl font-black text-white">#{myRank}</p>
          </div>
        )}
      </div>

      {error && <div className="rounded-xl border border-red-800 bg-red-950 p-3 text-sm text-red-200">{error}</div>}

      {/* Top 3 podium */}
      {players.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {/* 2nd place */}
          <div className="mt-8">
            <PodiumCard player={players[1]} rank={2} />
          </div>
          {/* 1st place */}
          <div>
            <PodiumCard player={players[0]} rank={1} />
          </div>
          {/* 3rd place */}
          <div className="mt-12">
            <PodiumCard player={players[2]} rank={3} />
          </div>
        </div>
      )}

      {/* Rest of the list */}
      <div className="space-y-2">
        {players.slice(3).map((player, i) => {
          const rank = i + 4;
          const tier = getRankTier(player.elo);
          const isMe = player.id === user?.id;

          return (
            <Link key={player.id} href={`/profile/${player.username}`}>
              <Card className={`flex items-center gap-4 py-3 px-4 hover:border-primary/30 transition cursor-pointer ${
                isMe ? "ring-1 ring-primary/30 bg-primary/5" : ""
              }`}>
                <span className="w-8 text-center font-bold text-muted text-sm">{rank}</span>
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${tier.color} flex items-center justify-center shrink-0`}>
                  <span className="text-xs text-white font-bold">{tier.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">
                    {player.username}
                    {isMe && <span className="text-xs text-primary ml-2">(you)</span>}
                  </p>
                  <p className={`text-xs ${tier.textColor}`}>{tier.name}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>
                    {player.elo}
                  </p>
                  {(player.wins !== undefined || player.totalMatches !== undefined) && (
                    <p className="text-[10px] text-muted">
                      {player.wins ?? 0}W / {player.losses ?? 0}L
                    </p>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {players.length === 0 && (
        <Card className="py-8 text-center text-muted">
          <p className="text-lg mb-2">No players yet. Be the first to compete!</p>
        </Card>
      )}
    </main>
  );
}

function PodiumCard({ player, rank }: { player: LeaderboardEntry; rank: number }) {
  const tier = getRankTier(player.elo);
  const medals = ["", "1st", "2nd", "3rd"];
  const heights = ["", "h-32", "h-24", "h-20"];
  const glows = ["", "shadow-yellow-500/30", "shadow-gray-400/20", "shadow-orange-400/20"];

  return (
    <Link href={`/profile/${player.username}`}>
      <div className={`rounded-2xl border border-slate-700/60 bg-gradient-to-b from-surface-soft to-surface p-5 text-center hover:border-primary/30 transition cursor-pointer shadow-lg ${glows[rank]}`}>
        <div className="text-2xl font-bold mb-3 text-yellow-500">{medals[rank]}</div>
        <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center shadow-xl mb-3`}>
          <span className="text-2xl text-white font-bold">{tier.icon}</span>
        </div>
        <p className="font-bold text-white text-lg truncate">{player.username}</p>
        <p className={`text-sm font-semibold ${tier.textColor}`}>{tier.name}</p>
        <p className={`text-2xl font-black mt-2 bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>{player.elo}</p>
        {player.wins !== undefined && (
          <p className="text-xs text-muted mt-1">{player.wins}W / {player.losses ?? 0}L</p>
        )}
      </div>
    </Link>
  );
}

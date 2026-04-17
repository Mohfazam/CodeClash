"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { getRankTier } from "@/lib/types";

type UserProfile = {
  id: string;
  username: string;
  elo: number;
  metadata?: {
    avatar_url?: string;
    college?: string;
    bio?: string;
  };
  codeDna?: {
    weak_topics?: string[];
    patterns?: string[];
    ai_summary?: string;
  };
  createdAt: string;
};

type UserStats = {
  wins: number;
  losses: number;
  totalMatches: number;
  eloHistory: Array<{ delta: number; oldElo: number; newElo: number; createdAt: string }>;
  topicStats?: Array<{
    topic: string;
    wins: number;
    losses: number;
    avgSolveTimeMs?: number;
    last5Outcomes: Array<"W" | "L">;
  }>;
};

// Draw ELO history sparkline on canvas
function drawEloChart(canvas: HTMLCanvasElement, data: { oldElo: number; newElo: number; delta: number }[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx || data.length < 2) return;

  const w = canvas.width;
  const h = canvas.height;
  const padding = 20;

  // Build ELO series from oldElo → newElo
  const eloSeries = [data[data.length - 1].oldElo];
  for (let i = data.length - 1; i >= 0; i--) {
    eloSeries.push(data[i].newElo);
  }

  const min = Math.min(...eloSeries) - 20;
  const max = Math.max(...eloSeries) + 20;
  const range = max - min || 1;

  ctx.clearRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + ((h - 2 * padding) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(w - padding, y);
    ctx.stroke();
  }

  // Line
  ctx.beginPath();
  ctx.strokeStyle = "#7c3aed";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  eloSeries.forEach((elo, i) => {
    const x = padding + (i / (eloSeries.length - 1)) * (w - 2 * padding);
    const y = padding + ((max - elo) / range) * (h - 2 * padding);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, "rgba(124, 58, 237, 0.3)");
  gradient.addColorStop(1, "rgba(124, 58, 237, 0)");

  ctx.lineTo(w - padding, h - padding);
  ctx.lineTo(padding, h - padding);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Dots
  eloSeries.forEach((elo, i) => {
    const x = padding + (i / (eloSeries.length - 1)) * (w - 2 * padding);
    const y = padding + ((max - elo) / range) * (h - 2 * padding);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = i > 0 && eloSeries[i] >= eloSeries[i - 1] ? "#22c55e" : "#ef4444";
    if (i === 0) ctx.fillStyle = "#7c3aed";
    ctx.fill();
  });

  // Labels
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(String(max), padding - 4, padding + 4);
  ctx.fillText(String(min), padding - 4, h - padding + 4);
}

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const username = String(params.username);
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ bio: "", college: "", avatar_url: "" });
  const [saving, setSaving] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);

  const isOwnProfile = user?.username === username;

  useEffect(() => {
    if (!token) return;
    setLoading(true);

    // Always call the public stats endpoint for any user
    Promise.all([
      apiRequest<UserProfile>({ path: `/api/users/${username}`, token }),
      apiRequest<UserStats>({ path: `/api/users/${username}/stats`, token }),
    ])
      .then(([profileData, statsData]) => {
        setProfile(profileData);
        setStats(statsData);
        setEditData({
          bio: profileData.metadata?.bio || "",
          college: profileData.metadata?.college || "",
          avatar_url: profileData.metadata?.avatar_url || "",
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [token, username]);

  // Draw ELO chart when data loads
  useEffect(() => {
    if (chartRef.current && stats?.eloHistory && stats.eloHistory.length >= 2) {
      const canvas = chartRef.current;
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(2, 2);
      drawEloChart(canvas, stats.eloHistory as any);
    }
  }, [stats]);

  const handleSaveProfile = async () => {
    if (!token || !isOwnProfile) return;
    setSaving(true);
    try {
      await apiRequest({
        path: "/api/users/me",
        method: "PATCH",
        token,
        body: editData,
      });
      setProfile((prev) =>
        prev ? { ...prev, metadata: { ...prev.metadata, ...editData } } : null
      );
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="space-y-4 text-center py-20">
        <p className="text-muted text-lg">User not found</p>
        <Link href="/dashboard" className="text-primary hover:underline text-sm">Back to Dashboard</Link>
      </main>
    );
  }

  const winRate = stats && stats.totalMatches > 0 ? (stats.wins / stats.totalMatches * 100).toFixed(1) : "0";
  const recentEloHistory = stats?.eloHistory?.slice(0, 5) || [];
  const tier = getRankTier(profile.elo);

  return (
    <main className="space-y-6 max-w-5xl mx-auto">
      {error && <div className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">{error}</div>}

      {/* ══ Profile Header ══ */}
      <div className={`rounded-2xl border border-slate-700/60 p-6 ${tier.bgColor} relative overflow-hidden`}>
        {/* Glow effect */}
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl opacity-20 bg-gradient-to-br ${tier.color}`} />

        <div className="flex items-start justify-between gap-6 relative z-10">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${tier.color} flex items-center justify-center shadow-lg ${tier.glowColor} shadow-xl`}>
                {profile.metadata?.avatar_url ? (
                  <img src={profile.metadata.avatar_url} alt={profile.username} className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-white">{profile.username[0].toUpperCase()}</span>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold">{profile.username}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-bold ${tier.textColor} bg-slate-900/50 px-2 py-0.5 rounded-full`}>
                    {tier.icon} {tier.name}
                  </span>
                  <span className="text-sm text-muted">Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {isEditing && isOwnProfile ? (
              <div className="space-y-3 mt-4 max-w-md">
                <div>
                  <label className="block text-sm text-muted mb-1">Bio</label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    className="w-full rounded-lg border border-border bg-surface-soft px-3 py-2 text-sm outline-none resize-none"
                    rows={3}
                    maxLength={300}
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">College</label>
                  <Input
                    value={editData.college}
                    onChange={(e) => setEditData({ ...editData, college: e.target.value })}
                    placeholder="e.g., IIT Delhi"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Avatar URL</label>
                  <Input
                    value={editData.avatar_url}
                    onChange={(e) => setEditData({ ...editData, avatar_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveProfile} disabled={saving} className="flex-1 bg-green-700">
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  <Button onClick={() => setIsEditing(false)} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {profile.metadata?.bio && <p className="text-sm mt-2 text-gray-300">{profile.metadata.bio}</p>}
                {profile.metadata?.college && <p className="text-sm text-muted mt-1">College: {profile.metadata.college}</p>}
                {isOwnProfile && !isEditing && (
                  <Button onClick={() => setIsEditing(true)} className="mt-4" size="sm">
                    Edit Profile
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="text-right">
            <p className={`text-5xl font-black bg-gradient-to-r ${tier.color} bg-clip-text text-transparent`}>{profile.elo}</p>
            <p className="text-sm text-muted mt-1">ELO Rating</p>
          </div>
        </div>
      </div>

      {/* ══ Stats Grid ══ */}
      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Total Matches</p>
          <p className="mt-2 text-3xl font-bold">{stats?.totalMatches ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Win Rate</p>
          <p className="mt-2 text-3xl font-bold text-green-400">{winRate}%</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Wins</p>
          <p className="mt-2 text-3xl font-bold text-green-400">{stats?.wins ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Losses</p>
          <p className="mt-2 text-3xl font-bold text-red-400">{stats?.losses ?? 0}</p>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* ══ ELO History Chart ══ */}
        {stats?.eloHistory && stats.eloHistory.length >= 2 && (
          <Card className="lg:col-span-2">
            <h2 className="font-semibold mb-3">ELO History</h2>
            <div className="relative" style={{ height: 200 }}>
              <canvas
                ref={chartRef}
                className="w-full h-full"
                style={{ width: "100%", height: "100%" }}
              />
            </div>
          </Card>
        )}

        {/* ══ Recent ELO Changes ══ */}
        {recentEloHistory.length > 0 && (
          <Card className="lg:col-span-1">
            <h2 className="font-semibold mb-3">Recent ELO Changes</h2>
            <div className="space-y-2">
              {recentEloHistory.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/30 last:border-0">
                  <p className="text-muted text-xs">{new Date(entry.createdAt).toLocaleDateString()}</p>
                  <span className={`font-bold ${entry.delta > 0 ? "text-green-400" : "text-red-400"}`}>
                    {entry.delta > 0 ? "+" : ""}{entry.delta}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ══ Achievements ══ */}
        {stats && stats.totalMatches > 0 && (
          <Card className="lg:col-span-3">
            <h2 className="font-semibold mb-3">Achievements</h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {stats.wins > 0 && (
                <div className="rounded-xl border border-yellow-600/40 bg-yellow-900/10 p-3 text-center hover:bg-yellow-900/20 transition">
                  <p className="text-2xl font-bold text-yellow-300">✦</p>
                  <p className="text-xs font-semibold mt-1">First Victory</p>
                  <p className="text-xs text-muted">{stats.wins} wins</p>
                </div>
              )}
              {Number(winRate) >= 50 && stats.totalMatches >= 5 && (
                <div className="rounded-xl border border-green-600/40 bg-green-900/10 p-3 text-center hover:bg-green-900/20 transition">
                  <p className="text-2xl font-bold text-green-300">▲</p>
                  <p className="text-xs font-semibold mt-1">Consistent</p>
                  <p className="text-xs text-muted">{winRate}% win rate</p>
                </div>
              )}
              {stats.topicStats && stats.topicStats.some(t => t.wins > 3) && (
                <div className="rounded-xl border border-purple-600/40 bg-purple-900/10 p-3 text-center hover:bg-purple-900/20 transition">
                  <p className="text-2xl font-bold text-purple-300">◆</p>
                  <p className="text-xs font-semibold mt-1">Specialist</p>
                  <p className="text-xs text-muted">Master a topic</p>
                </div>
              )}
              {stats.totalMatches >= 20 && (
                <div className="rounded-xl border border-blue-600/40 bg-blue-900/10 p-3 text-center hover:bg-blue-900/20 transition">
                  <p className="text-2xl font-bold text-blue-300">●</p>
                  <p className="text-xs font-semibold mt-1">Battle Veteran</p>
                  <p className="text-xs text-muted">{stats.totalMatches} matches</p>
                </div>
              )}
              {stats.totalMatches >= 10 && (
                <div className="rounded-xl border border-indigo-600/40 bg-indigo-900/10 p-3 text-center hover:bg-indigo-900/20 transition">
                  <p className="text-2xl font-bold text-indigo-300">◎</p>
                  <p className="text-xs font-semibold mt-1">Competitor</p>
                  <p className="text-xs text-muted">10+ matches</p>
                </div>
              )}
              {stats.wins >= 5 && (
                <div className="rounded-xl border border-amber-600/40 bg-amber-900/10 p-3 text-center hover:bg-amber-900/20 transition">
                  <p className="text-2xl font-bold text-amber-300">♦</p>
                  <p className="text-xs font-semibold mt-1">Unstoppable</p>
                  <p className="text-xs text-muted">5+ victories</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ══ Code DNA ══ */}
        {profile.codeDna && (profile.codeDna.weak_topics?.length || profile.codeDna.patterns?.length) && (
          <Card className="lg:col-span-1">
            <h2 className="font-semibold mb-3">Code DNA</h2>
            {profile.codeDna.weak_topics && profile.codeDna.weak_topics.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-muted mb-2">Weak Topics</p>
                <div className="flex flex-wrap gap-1">
                  {profile.codeDna.weak_topics.map((topic) => (
                    <span key={topic} className="px-2 py-1 rounded-full bg-red-900/30 text-red-300 text-xs border border-red-800/30">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {profile.codeDna.patterns && profile.codeDna.patterns.length > 0 && (
              <div>
                <p className="text-xs text-muted mb-2">Patterns</p>
                <div className="flex flex-wrap gap-1">
                  {profile.codeDna.patterns.map((pattern) => (
                    <span key={pattern} className="px-2 py-1 rounded-full bg-blue-900/30 text-blue-300 text-xs border border-blue-800/30">
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ══ Topic Performance Heatmap ══ */}
        {stats?.topicStats && stats.topicStats.length > 0 && (
          <Card className="lg:col-span-2">
            <h2 className="font-semibold mb-4">Topic Performance</h2>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
              {stats.topicStats.map((topic) => {
                const topicTotal = topic.wins + topic.losses;
                const topicWinRate = topicTotal > 0 ? (topic.wins / topicTotal * 100).toFixed(0) : "0";
                return (
                  <div key={topic.topic} className="rounded-xl border border-border bg-surface-soft p-3 hover:border-primary/30 transition">
                    <p className="font-semibold text-sm mb-2 capitalize">{topic.topic}</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-green-400 font-medium">{topic.wins}W</span>
                      <span className="text-xs text-red-400 font-medium">{topic.losses}L</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all"
                        style={{ width: `${topicWinRate}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted mt-1">{topicWinRate}% win rate</p>
                    {topic.last5Outcomes && topic.last5Outcomes.length > 0 && (
                      <div className="flex gap-0.5 mt-2">
                        {topic.last5Outcomes.map((outcome, i) => (
                          <div
                            key={i}
                            className={`w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold ${
                              outcome === "W" ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"
                            }`}
                          >
                            {outcome}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}

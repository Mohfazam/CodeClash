"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

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
  eloHistory: Array<{ delta: number; createdAt: string }>;
  topicStats?: Array<{
    topic: string;
    wins: number;
    losses: number;
    avgSolveTimeMs?: number;
    last5Outcomes: Array<"W" | "L">;
  }>;
};

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

  const isOwnProfile = user?.username === username;

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    // For stats, use /me/stats for own profile, otherwise public profile has topicStats
    const statsPath = user?.username === username ? "/api/users/me/stats" : null;
    Promise.all([
      apiRequest<UserProfile>({ path: `/api/users/${username}`, token }),
      statsPath ? apiRequest<UserStats>({ path: statsPath, token }) : Promise.resolve(null as unknown as UserStats),
    ])
      .then(([profileData, statsData]) => {
        setProfile(profileData);
        // For own profile, use stats endpoint; for others, build from topicStats in profile
        if (statsData) {
          setStats(statsData);
        } else {
          setStats({ wins: 0, losses: 0, totalMatches: 0, eloHistory: [], topicStats: (profileData as any).topicStats ?? [] });
        }
        setEditData({
          bio: profileData.metadata?.bio || "",
          college: profileData.metadata?.college || "",
          avatar_url: profileData.metadata?.avatar_url || "",
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [token, username, user?.username]);

  const handleSaveProfile = async () => {
    if (!token || !isOwnProfile) return;
    setSaving(true);
    try {
      // API expects bio, college, avatar_url directly (not nested)
      await apiRequest({
        path: "/api/users/me",
        method: "PATCH",
        token,
        body: editData,
      });
      setProfile((prev) =>
        prev
          ? { ...prev, metadata: { ...prev.metadata, ...editData } }
          : null
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
        <p className="text-muted">Loading profile...</p>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="space-y-4">
        <p className="text-muted">User not found</p>
      </main>
    );
  }

  const winRate = stats && stats.totalMatches > 0 ? (stats.wins / stats.totalMatches * 100).toFixed(1) : 0;
  const recentEloHistory = stats?.eloHistory.slice(0, 5) || [];

  return (
    <main className="space-y-6">
      {error && <div className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-200">{error}</div>}

      {/* Profile Header */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                {profile.metadata?.avatar_url ? (
                  <img src={profile.metadata.avatar_url} alt={profile.username} className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-white">{profile.username[0].toUpperCase()}</span>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold">{profile.username}</h1>
                <p className="text-sm text-muted">Joined {new Date(profile.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {isEditing && isOwnProfile ? (
              <div className="space-y-3 mt-4 max-w-md">
                <div>
                  <label className="block text-sm text-muted mb-1">Bio</label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    className="w-full rounded border border-border bg-surface-soft px-3 py-2 text-sm outline-none resize-none"
                    rows={3}
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
                {profile.metadata?.bio && <p className="text-sm mt-2">{profile.metadata.bio}</p>}
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
            <p className="text-4xl font-bold text-primary">{profile.elo}</p>
            <p className="text-sm text-muted">ELO Rating</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stats Cards */}
        <section className="lg:col-span-3 grid gap-4 grid-cols-3">
          <Card>
            <p className="text-xs text-muted">Total Matches</p>
            <p className="mt-2 text-3xl font-bold">{stats?.totalMatches ?? 0}</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Win Rate</p>
            <p className="mt-2 text-3xl font-bold text-green-400">{winRate}%</p>
          </Card>
          <Card>
            <p className="text-xs text-muted">Wins / Losses</p>
            <p className="mt-2 text-2xl font-bold">
              <span className="text-green-400">{stats?.wins ?? 0}</span>
              <span className="text-muted mx-2">/</span>
              <span className="text-red-400">{stats?.losses ?? 0}</span>
            </p>
          </Card>
        </section>

        {/* Achievements/Badges */}
        {stats && stats.totalMatches > 0 && (
          <Card className="lg:col-span-3">
            <h2 className="font-semibold mb-3">Achievements</h2>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              {stats.wins > 0 && (
                <div className="rounded-lg border border-yellow-600 bg-yellow-900/20 p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-300">✦</p>
                  <p className="text-xs font-semibold mt-1">First Victory</p>
                  <p className="text-xs text-muted">{stats.wins} wins</p>
                </div>
              )}
              {Number(winRate) >= 50 && stats.totalMatches >= 5 && (
                <div className="rounded-lg border border-green-600 bg-green-900/20 p-3 text-center">
                  <p className="text-2xl font-bold text-green-300">▲</p>
                  <p className="text-xs font-semibold mt-1">Consistent</p>
                  <p className="text-xs text-muted">{winRate}% win rate</p>
                </div>
              )}
              {stats.topicStats && stats.topicStats.some(t => t.wins > 3) && (
                <div className="rounded-lg border border-purple-600 bg-purple-900/20 p-3 text-center">
                  <p className="text-2xl font-bold text-purple-300">◆</p>
                  <p className="text-xs font-semibold mt-1">Specialist</p>
                  <p className="text-xs text-muted">Master a topic</p>
                </div>
              )}
              {stats.totalMatches >= 20 && (
                <div className="rounded-lg border border-blue-600 bg-blue-900/20 p-3 text-center">
                  <p className="text-2xl font-bold text-blue-300">●</p>
                  <p className="text-xs font-semibold mt-1">Battle Veteran</p>
                  <p className="text-xs text-muted">{stats.totalMatches} matches</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Recent ELO Changes */}
        {recentEloHistory.length > 0 && (
          <Card className="lg:col-span-1">
            <h2 className="font-semibold mb-3">Recent ELO Changes</h2>
            <div className="space-y-2">
              {recentEloHistory.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <p className="text-muted">{new Date(entry.createdAt).toLocaleDateString()}</p>
                  <span className={entry.delta > 0 ? "text-green-400" : "text-red-400"}>
                    {entry.delta > 0 ? "+" : ""}{entry.delta}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Code DNA */}
        {profile.codeDna && (
          <Card className="lg:col-span-1">
            <h2 className="font-semibold mb-3">Code DNA</h2>
            {profile.codeDna.weak_topics && profile.codeDna.weak_topics.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-muted mb-2">Weak Topics</p>
                <div className="flex flex-wrap gap-1">
                  {profile.codeDna.weak_topics.map((topic) => (
                    <span key={topic} className="px-2 py-1 rounded bg-red-900/30 text-red-300 text-xs">
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
                    <span key={pattern} className="px-2 py-1 rounded bg-blue-900/30 text-blue-300 text-xs">
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Topic Performance Heatmap */}
        {stats?.topicStats && stats.topicStats.length > 0 && (
          <Card className="lg:col-span-2">
            <h2 className="font-semibold mb-4">Topic Performance</h2>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
              {stats.topicStats.map((topic) => {
                const topicWinRate = topic.wins + topic.losses > 0 ? (topic.wins / (topic.wins + topic.losses) * 100).toFixed(0) : 0;
                return (
                  <div key={topic.topic} className="rounded border border-border bg-surface-soft p-3">
                    <p className="font-semibold text-sm mb-2 capitalize">{topic.topic}</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-green-400">{topic.wins}W</span>
                      <span className="text-xs text-red-400">{topic.losses}L</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-border overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600"
                        style={{ width: `${topicWinRate}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted mt-1">{topicWinRate}% win rate</p>
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

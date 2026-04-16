"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";
import { Room } from "@/lib/types";

export default function NewRoomPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [topic, setTopic] = useState("");
  const [timeLimit, setTimeLimit] = useState(30);
  const [deadManSwitch, setDeadManSwitch] = useState(true);
  const [blindRating, setBlindRating] = useState(false);
  const [spectators, setSpectators] = useState(true);
  const [liveCommentary, setLiveCommentary] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const createRoom = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const room = await apiRequest<Room>({
        path: "/api/rooms",
        method: "POST",
        token,
        body: {
          options: {
            difficulty,
            topic: topic || null,
            time_limit_minutes: timeLimit,
            spectators_allowed: spectators,
            live_commentator: liveCommentary,
            blind_rating: { enabled: blindRating },
            dead_mans_switch: { enabled: deadManSwitch, idle_seconds: 45 },
          },
        },
      });
      router.push(`/room/${room.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = (e: FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) return;
    router.push(`/room/${roomCode.trim().toUpperCase()}`);
  };

  return (
    <main className="grid gap-4 md:grid-cols-2">
      <Card className="space-y-4">
        <h1 className="text-xl font-semibold">Create battle room</h1>
        <div className="space-y-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Difficulty</span>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as "easy" | "medium" | "hard")}
              className="w-full rounded-lg border border-border bg-surface-soft px-3 py-2 outline-none"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Topic (optional)</span>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="graphs, dp, arrays..." />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Time limit (minutes)</span>
            <Input
              type="number"
              min={5}
              max={120}
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
            />
          </label>

          {/* Advanced Options */}
          <div className="border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted mb-3">Advanced Options</p>
            
            <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deadManSwitch}
                onChange={(e) => setDeadManSwitch(e.target.checked)}
                className="rounded border-border"
              />
              <span>Dead Man's Switch (auto-remove idle players)</span>
            </label>

            <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={blindRating}
                onChange={(e) => setBlindRating(e.target.checked)}
                className="rounded border-border"
              />
              <span>Blind Rating (hide opponent ELO)</span>
            </label>

            <label className="flex items-center gap-2 text-sm mb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={liveCommentary}
                onChange={(e) => setLiveCommentary(e.target.checked)}
                className="rounded border-border"
              />
              <span>Live AI Commentary</span>
            </label>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={spectators}
                onChange={(e) => setSpectators(e.target.checked)}
                className="rounded border-border"
              />
              <span>Allow Spectators</span>
            </label>
          </div>
        </div>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <Button onClick={createRoom} disabled={loading}>
          {loading ? "Creating..." : "Create room"}
        </Button>
      </Card>
      <Card className="space-y-4">
        <h2 className="text-xl font-semibold">Join by room code</h2>
        <form className="space-y-3" onSubmit={joinRoom}>
          <Input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="ABC123" maxLength={6} />
          <Button type="submit" variant="outline">
            Open room
          </Button>
        </form>
      </Card>
    </main>
  );
}

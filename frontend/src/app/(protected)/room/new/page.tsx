"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { Room } from "@/lib/types";

const TOPICS = ["arrays", "strings", "hashmaps", "trees", "graphs", "dp", "sorting", "math", "greedy", "two pointers"];

export default function NewRoomPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [roomCode, setRoomCode] = useState("");
  const [joining, setJoining] = useState(false);

  // Room options
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [timeLimit, setTimeLimit] = useState(30);
  const [liveCommentator, setLiveCommentator] = useState(true);
  const [deadMansSwitch, setDeadMansSwitch] = useState(true);
  const [idleSeconds, setIdleSeconds] = useState(120);
  const [blindRating, setBlindRating] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const createRoom = async () => {
    if (!token) return;
    setCreating(true);
    setError("");

    try {
      const room = await apiRequest<Room>({
        path: "/api/rooms",
        method: "POST",
        token,
        body: {
          options: {
            difficulty,
            time_limit_minutes: timeLimit,
            topic: selectedTopic,
            live_commentator: liveCommentator,
            dead_mans_switch: { enabled: deadMansSwitch, idle_seconds: idleSeconds },
            blind_rating: { enabled: blindRating },
          }
        },
      });
      router.push(`/room/${room.roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async () => {
    if (!token || !roomCode) return;
    setJoining(true);
    setError("");

    try {
      await apiRequest({ path: `/api/rooms/${roomCode}/join`, method: "POST", token });
      router.push(`/room/${roomCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room");
    } finally {
      setJoining(false);
    }
  };

  const difficultyOptions = [
    { value: "easy", label: "Easy", desc: "Good for warm-up", color: "border-green-500/50 bg-green-900/10 hover:bg-green-900/20", active: "ring-2 ring-green-500 bg-green-900/30" },
    { value: "medium", label: "Medium", desc: "Balanced challenge", color: "border-yellow-500/50 bg-yellow-900/10 hover:bg-yellow-900/20", active: "ring-2 ring-yellow-500 bg-yellow-900/30" },
    { value: "hard", label: "Hard", desc: "For the brave", color: "border-red-500/50 bg-red-900/10 hover:bg-red-900/20", active: "ring-2 ring-red-500 bg-red-900/30" },
  ] as const;

  const timeLimitOptions = [10, 15, 20, 30, 45, 60];

  return (
    <main className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{mode === "create" ? "Create" : "Join"} Battle Room</h1>
          <p className="text-muted text-sm mt-1">{mode === "create" ? "Configure your match settings and challenge an opponent" : "Enter a room code to join a battle"}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("create")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              mode === "create"
                ? "bg-primary text-white"
                : "bg-surface-soft text-muted hover:text-white hover:bg-surface"
            }`}
          >
            Create
          </button>
          <button
            onClick={() => setMode("join")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              mode === "join"
                ? "bg-primary text-white"
                : "bg-surface-soft text-muted hover:text-white hover:bg-surface"
            }`}
          >
            Join
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950 p-3 text-sm text-red-200">{error}</div>
      )}

      {mode === "join" && (
        <Card className="border-primary/20 bg-gradient-to-br from-surface to-surface-soft p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Room Code</label>
              <input
                type="text"
                placeholder="e.g. ABC123"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
              />
              <p className="text-xs text-muted mt-1">Enter the 6-character room code from your friend</p>
            </div>
            <Button
              onClick={joinRoom}
              disabled={joining || !roomCode || roomCode.length !== 6}
              className="w-full py-3 text-base font-bold bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-500/20"
            >
              {joining ? "Joining..." : "Join Room"}
            </Button>
          </div>
        </Card>
      )}

      {/* Difficulty Selector */}
      {mode === "create" && (
        <h2 className="font-semibold text-lg mb-1">Difficulty</h2>
        <p className="text-xs text-muted mb-4">Choose the problem difficulty for this battle</p>
        <div className="grid gap-3 grid-cols-3">
          {difficultyOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDifficulty(opt.value)}
              className={`rounded-2xl border p-5 text-center transition-all ${
                difficulty === opt.value ? opt.active : opt.color
              }`}
            >
              <p className="font-bold text-white text-lg">{opt.label}</p>
              <p className="text-xs text-muted mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Topic Picker */}
      {mode === "create" && (
        <h2 className="font-semibold text-lg mb-1">Topic (Optional)</h2>
        <p className="text-xs text-muted mb-4">Filter problems by topic, or leave blank for random</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedTopic(null)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              selectedTopic === null
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                : "bg-transparent text-muted border-border hover:border-gray-500 hover:text-white"
            }`}
          >
            Random
          </button>
          {TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => setSelectedTopic(topic)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all capitalize ${
                selectedTopic === topic
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-transparent text-muted border-border hover:border-gray-500 hover:text-white"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </section>

      {/* Time Limit */}
      {mode === "create" && (
        <h2 className="font-semibold text-lg mb-1">Time Limit</h2>
        <p className="text-xs text-muted mb-4">How long each player gets to solve the problem</p>
        <div className="flex flex-wrap gap-2">
          {timeLimitOptions.map((t) => (
            <button
              key={t}
              onClick={() => setTimeLimit(t)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                timeLimit === t
                  ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                  : "bg-transparent text-muted border-border hover:border-gray-500 hover:text-white"
              }`}
            >
              {t} min
            </button>
          ))}
        </div>
      </section>
      )}

      {/* Advanced Options */}
      {mode === "create" && (
        <h2 className="font-semibold text-lg mb-1">Battle Features</h2>
        <p className="text-xs text-muted mb-4">Customize your battle experience</p>

        <div className="grid gap-3 md:grid-cols-2">
          {/* Live Commentator */}
          <button
            onClick={() => setLiveCommentator(!liveCommentator)}
            className={`rounded-2xl border p-4 text-left transition-all ${
              liveCommentator
                ? "border-cyan-500/40 bg-cyan-900/10 ring-2 ring-cyan-500/30"
                : "border-border bg-surface-soft hover:border-gray-600"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-cyan-400">AI</span>
              <div className={`w-10 h-5 rounded-full transition-all ${liveCommentator ? "bg-cyan-500" : "bg-gray-700"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all mt-0.5 ${liveCommentator ? "ml-5" : "ml-0.5"}`} />
              </div>
            </div>
            <p className="font-semibold text-white text-sm">AI Commentator</p>
            <p className="text-xs text-muted mt-0.5">Live AI commentary during the match</p>
          </button>

          {/* Dead Man's Switch */}
          <button
            onClick={() => setDeadMansSwitch(!deadMansSwitch)}
            className={`rounded-2xl border p-4 text-left transition-all ${
              deadMansSwitch
                ? "border-red-500/40 bg-red-900/10 ring-2 ring-red-500/30"
                : "border-border bg-surface-soft hover:border-gray-600"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-red-400">IDLE</span>
              <div className={`w-10 h-5 rounded-full transition-all ${deadMansSwitch ? "bg-red-500" : "bg-gray-700"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all mt-0.5 ${deadMansSwitch ? "ml-5" : "ml-0.5"}`} />
              </div>
            </div>
            <p className="font-semibold text-white text-sm">Dead Man&apos;s Switch</p>
            <p className="text-xs text-muted mt-0.5">Idle too long = code gets deleted</p>
          </button>

          {/* Blind Rating */}
          <button
            onClick={() => setBlindRating(!blindRating)}
            className={`rounded-2xl border p-4 text-left transition-all ${
              blindRating
                ? "border-purple-500/40 bg-purple-900/10 ring-2 ring-purple-500/30"
                : "border-border bg-surface-soft hover:border-gray-600"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-purple-400">BLIND</span>
              <div className={`w-10 h-5 rounded-full transition-all ${blindRating ? "bg-purple-500" : "bg-gray-700"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all mt-0.5 ${blindRating ? "ml-5" : "ml-0.5"}`} />
              </div>
            </div>
            <p className="font-semibold text-white text-sm">Blind Rating</p>
            <p className="text-xs text-muted mt-0.5">Hide opponent identity until match ends</p>
          </button>

          {/* Idle Timer Config */}
          {deadMansSwitch && (
            <div className="rounded-2xl border border-border bg-surface-soft p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-bold text-orange-400">TIME</span>
                <div>
                  <p className="font-semibold text-white text-sm">Idle Threshold</p>
                  <p className="text-xs text-muted">Seconds before idle penalty triggers</p>
                </div>
              </div>
              <div className="flex gap-2">
                {[60, 90, 120, 180].map((s) => (
                  <button
                    key={s}
                    onClick={() => setIdleSeconds(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${
                      idleSeconds === s
                        ? "bg-primary text-white border-primary"
                        : "bg-transparent text-muted border-border hover:border-gray-500"
                    }`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {/* Preview & Create */}
      {mode === "create" && (
      <Card className="border-primary/20 bg-gradient-to-br from-surface to-surface-soft">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-wider mb-1.5">Battle Summary</p>
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <span className={`px-2 py-0.5 rounded-full font-bold ${
                difficulty === "easy" ? "bg-green-900/50 text-green-300" :
                difficulty === "medium" ? "bg-yellow-900/50 text-yellow-300" :
                "bg-red-900/50 text-red-300"
              }`}>
                {difficulty}
              </span>
              <span className="text-muted">·</span>
              <span className="font-medium">{timeLimit} min</span>
              <span className="text-muted">·</span>
              <span className="capitalize">{selectedTopic ?? "random topic"}</span>
              {liveCommentator && <span className="text-cyan-400 text-xs">AI ON</span>}
              {deadMansSwitch && <span className="text-red-400 text-xs">IDLE ON</span>}
              {blindRating && <span className="text-purple-400 text-xs">BLIND</span>}
            </div>
          </div>
          <Button
            onClick={createRoom}
            disabled={creating}
            className="px-8 py-3 text-base font-bold bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-500/20"
          >
            {creating ? "Creating..." : "Create Room"}
          </Button>
        </div>
      </Card>
      )}
    </main>
  );
}

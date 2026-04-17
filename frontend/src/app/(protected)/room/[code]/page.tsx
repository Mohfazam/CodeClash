"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { getSocket, joinRoom as joinSocketRoom, leaveRoom as leaveSocketRoom } from "@/lib/socket";
import { Room, getRankTier } from "@/lib/types";

type StartPayload = { match: { id: string } };
type HistoryResponse = {
  matches: Array<{
    id: string;
    roomId: string;
    status: "active" | "finished" | "abandoned";
  }>;
};

export default function RoomPage() {
  const params = useParams<{ code: string }>();
  const code = useMemo(() => String(params.code).toUpperCase(), [params.code]);
  const router = useRouter();
  const { token, user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pendingMatchId, setPendingMatchId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const toMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

  const maybeAutoJoinAsGuest = useCallback(
    async (snapshot: Room) => {
      if (!token || !user) return snapshot;
      if (snapshot.hostId === user.id) return snapshot;
      if (snapshot.guestId || snapshot.status !== "waiting") return snapshot;

      try {
        const joined = await apiRequest<Room>({ path: `/api/rooms/${code}/join`, method: "POST", token });
        setStatus("Joined room successfully.");
        setError("");
        return joined;
      } catch (err) {
        setError(toMessage(err, "Unable to join room"));
        return snapshot;
      }
    },
    [token, user, code]
  );

  useEffect(() => {
    if (!token) return;
    apiRequest<Room>({ path: `/api/rooms/${code}`, token })
      .then((fetched) => maybeAutoJoinAsGuest(fetched))
      .then(setRoom)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load room"));
  }, [token, code, user, maybeAutoJoinAsGuest]);

  useEffect(() => {
    if (!token) return;
    joinSocketRoom(token, code);
    const socket = getSocket(token);

    socket.on("room:guest_joined", (data: { guest: { id: string; username: string; elo: number } }) => {
      setStatus("Guest joined. Ready to start!");
      setRoom((prev) => prev ? { ...prev, status: "ready", guestId: data.guest?.id ?? prev.guestId, guest: data.guest ?? prev.guest } : prev);
    });
    socket.on("room:countdown", ({ seconds }: { seconds: number }) => setCountdown(seconds));
    socket.on("match:started", ({ match_id }: { match_id: string }) => {
      router.push(`/battle/${match_id}`);
    });
    socket.on("match:join_room", ({ match_id }: { match_id: string }) => {
      joinSocketRoom(token, match_id);
    });
    socket.on("room:options_updated", ({ options }: { options: Room["options"] }) => {
      setRoom((prev) => prev ? { ...prev, options } : prev);
      setStatus("Room options updated.");
    });
    socket.on("room:closed", () => {
      setError("The host closed this room.");
      setTimeout(() => router.push("/dashboard"), 2000);
    });

    return () => {
      leaveSocketRoom(token, code);
      socket.off("room:guest_joined");
      socket.off("room:countdown");
      socket.off("match:started");
      socket.off("match:join_room");
      socket.off("room:options_updated");
      socket.off("room:closed");
    };
  }, [token, code, router]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const tick = window.setTimeout(() => setCountdown((prev) => (prev === null ? prev : Math.max(prev - 1, 0))), 1000);
    return () => window.clearTimeout(tick);
  }, [countdown]);

  useEffect(() => {
    if (!token || !room || room.status === "active" || room.status === "done") return;
    const interval = window.setInterval(() => {
      apiRequest<Room>({ path: `/api/rooms/${code}`, token })
        .then((fetched) => maybeAutoJoinAsGuest(fetched))
        .then(setRoom)
        .catch(() => {});
    }, 1500);
    return () => window.clearInterval(interval);
  }, [token, code, room, user, maybeAutoJoinAsGuest]);

  useEffect(() => {
    if (!token || !room || room.status !== "active") return;
    const interval = window.setInterval(() => {
      apiRequest<HistoryResponse>({ path: "/api/matches/history?limit=20&offset=0", token })
        .then((history) => {
          const current = history.matches.find((m) => m.roomId === room.id && m.status === "active");
          if (current) router.push(`/battle/${current.id}`);
        })
        .catch(() => {});
    }, 1200);
    return () => window.clearInterval(interval);
  }, [token, room, router]);

  const joinRoom = async () => {
    if (!token) return;
    setJoining(true);
    try {
      const joined = await apiRequest<Room>({ path: `/api/rooms/${code}/join`, method: "POST", token });
      setRoom(joined);
      setStatus("Joined room successfully.");
      setError("");
    } catch (err) {
      setError(toMessage(err, "Unable to join room"));
    } finally {
      setJoining(false);
    }
  };

  const startMatch = async () => {
    if (!token) return;
    setStarting(true);
    try {
      const started = await apiRequest<StartPayload>({ path: `/api/rooms/${code}/start`, method: "POST", token });
      setPendingMatchId(started.match.id);
      setStatus(`Match starting...`);
      setError("");
    } catch (err) {
      setError(toMessage(err, "Unable to start match"));
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!pendingMatchId) return;
    const timeout = window.setTimeout(() => {
      router.push(`/battle/${pendingMatchId}`);
    }, 6200);
    return () => window.clearTimeout(timeout);
  }, [pendingMatchId, router]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHost = room?.hostId === user?.id;
  const isReady = room?.status === "ready";
  const isRoomFull = Boolean(room?.guestId);
  const guestTakenByOther = Boolean(room?.guestId && room.guestId !== user?.id);
  const userRole = isHost ? "Host" : room?.guestId === user?.id ? "Guest" : "Viewer";
  const hostName = room?.host?.username ?? "Host";
  const guestName = room?.guest?.username ?? (room?.guestId ? "Joined" : "Waiting...");
  const hostTier = getRankTier(room?.host?.elo ?? 0);
  const guestTier = room?.guest ? getRankTier(room.guest.elo) : null;

  return (
    <main className="max-w-4xl mx-auto space-y-6">

      {/* Countdown overlay */}
      {countdown !== null && countdown > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center animate-scale-in">
            <p className="text-xl text-gray-400 mb-4">Match starts in</p>
            <div className="relative">
              <svg width="160" height="160" viewBox="0 0 160 160" className="mx-auto">
                <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                <circle
                  cx="80" cy="80" r="70"
                  fill="none"
                  stroke="url(#countdownGrad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={Math.PI * 140}
                  strokeDashoffset={Math.PI * 140 * (1 - countdown / 5)}
                  className="transition-all duration-1000"
                  transform="rotate(-90 80 80)"
                />
                <defs>
                  <linearGradient id="countdownGrad">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-7xl font-black text-white">
                {countdown}
              </span>
            </div>
            <p className="text-gray-500 mt-4">Get ready to code!</p>
          </div>
        </div>
      )}

      {/* Room Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-surface to-surface-soft relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary-soft">Battle Lobby</p>
              <div className="flex items-center gap-3 mt-1">
                <h1 className="text-4xl font-black tracking-wider">{code}</h1>
                <button
                  onClick={copyRoomCode}
                  className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary-soft hover:bg-primary/20 transition"
                >
                  {copied ? "✓ Copied!" : "📋 Copy"}
                </button>
              </div>
              <p className="mt-2 text-sm text-muted">Role: <span className="font-semibold text-foreground">{userRole}</span></p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted uppercase tracking-wider">Room Status</p>
              <p className={`text-lg font-bold capitalize ${
                room?.status === "waiting" ? "text-yellow-400" :
                room?.status === "ready" ? "text-green-400" :
                room?.status === "active" ? "text-blue-400" :
                "text-gray-400"
              }`}>
                {room?.status ?? "..."}
              </p>
            </div>
          </div>

          {status && <p className="mt-3 text-sm text-emerald-400 bg-emerald-900/10 rounded-lg px-3 py-1.5 border border-emerald-700/20">{status}</p>}
          {error && <p className="mt-3 text-sm text-red-400 bg-red-900/10 rounded-lg px-3 py-1.5 border border-red-700/20">{error}</p>}
        </div>
      </Card>

      {/* Room options display */}
      {room?.options && (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            { label: "Difficulty", value: room.options.difficulty ?? "Any", icon: "🎯" },
            { label: "Time Limit", value: `${room.options.time_limit_minutes ?? 30} min`, icon: "⏱️" },
            { label: "Commentary", value: room.options.live_commentator ? "ON" : "OFF", icon: "🤖" },
            { label: "Idle Penalty", value: room.options.dead_mans_switch?.enabled ? "ON" : "OFF", icon: "💀" },
          ].map(({ label, value, icon }) => (
            <div key={label} className="rounded-xl border border-border bg-surface-soft p-3 text-center">
              <p className="text-lg mb-1">{icon}</p>
              <p className="text-xs text-muted uppercase tracking-wider">{label}</p>
              <p className="font-bold text-white capitalize">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Players */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Host */}
        <Card className={`border-purple-700/30 ${isHost ? "ring-2 ring-purple-500/30" : ""}`}>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${hostTier.color} flex items-center justify-center shadow-lg`}>
              <span className="text-2xl text-white font-bold">{hostTier.icon}</span>
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wider">Host</p>
              <p className="text-xl font-bold text-white">{hostName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-sm font-bold ${hostTier.textColor}`}>{hostTier.name}</span>
                <span className="text-sm text-gray-400">·</span>
                <span className="text-sm text-gray-300 font-semibold">{room?.host?.elo ?? "?"} ELO</span>
              </div>
            </div>
          </div>
          {isHost && <p className="text-xs text-purple-400 mt-3">This is you</p>}
        </Card>

        {/* Guest */}
        <Card className={`border-cyan-700/30 ${room?.guestId === user?.id ? "ring-2 ring-cyan-500/30" : ""}`}>
          {room?.guest ? (
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${guestTier!.color} flex items-center justify-center shadow-lg`}>
                <span className="text-2xl text-white font-bold">{guestTier!.icon}</span>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider">Guest</p>
                <p className="text-xl font-bold text-white">{guestName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-sm font-bold ${guestTier!.textColor}`}>{guestTier!.name}</span>
                  <span className="text-sm text-gray-400">·</span>
                  <span className="text-sm text-gray-300 font-semibold">{room.guest.elo} ELO</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-gray-600 flex items-center justify-center">
                <span className="text-2xl text-gray-600">?</span>
              </div>
              <div>
                <p className="text-xs text-muted uppercase tracking-wider">Guest</p>
                <p className="text-lg text-gray-500 animate-pulse">Waiting for opponent...</p>
              </div>
            </div>
          )}
          {room?.guestId === user?.id && <p className="text-xs text-cyan-400 mt-3">This is you</p>}
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        {!isHost && !isRoomFull && (
          <Button onClick={joinRoom} disabled={joining} className="flex-1 py-3 bg-cyan-700 hover:bg-cyan-600">
            {joining ? "Joining..." : "Join as Guest"}
          </Button>
        )}
        {isHost && (
          <Button
            onClick={startMatch}
            disabled={!isReady || starting}
            className="flex-1 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/20"
          >
            {starting ? "Starting..." : isReady ? "⚔️ Start Match" : "Waiting for guest..."}
          </Button>
        )}
        {guestTakenByOther && <p className="text-xs text-red-400 w-full">Room already has a different guest.</p>}
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Room } from "@/lib/types";

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
    const socket = getSocket(token);
    socket.emit("room:join", { room_code: code });

    socket.on("room:guest_joined", () => {
      setStatus("Guest joined. Ready to start.");
      setRoom((prev) => (prev ? { ...prev, status: "ready" } : prev));
    });
    socket.on("room:countdown", ({ seconds }: { seconds: number }) => setCountdown(seconds));
    socket.on("match:started", ({ match_id }: { match_id: string }) => {
      router.push(`/battle/${match_id}`);
    });
    socket.on("match:join_room", ({ match_id }: { match_id: string }) => {
      socket.emit("room:join", { room_code: match_id });
    });

    return () => {
      socket.emit("room:leave", { room_code: code });
      socket.off("room:guest_joined");
      socket.off("room:countdown");
      socket.off("match:started");
      socket.off("match:join_room");
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
        .catch(() => {
          // no-op; keep polling
        });
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
        .catch(() => {
          // no-op
        });
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
      setStatus(`Match created: ${started.match.id}. Countdown starting...`);
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

  const isHost = room?.hostId === user?.id;
  const isReady = room?.status === "ready";
  const isRoomFull = Boolean(room?.guestId);
  const guestTakenByOther = Boolean(room?.guestId && room.guestId !== user?.id);
  const userRole = isHost ? "Host" : room?.guestId === user?.id ? "Guest" : "Viewer";
  const hostName = room?.host?.username ?? "Host";
  const guestName = room?.guest?.username ?? (room?.guestId ? "Joined" : "Waiting...");

  return (
    <main className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2 border-primary/20 bg-gradient-to-br from-surface to-surface-soft">
        <p className="text-xs uppercase tracking-[0.2em] text-primary-soft">Battle Lobby</p>
        <h1 className="mt-1 text-4xl font-semibold tracking-wider">{code}</h1>
        <p className="mt-2 text-sm text-muted">Role: {userRole}. Share this code with your opponent.</p>
        {countdown !== null && countdown > 0 ? (
          <p className="mt-4 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-lg text-primary-soft">
            Match starts in {countdown}s...
          </p>
        ) : null}
        {status ? <p className="mt-3 text-sm text-emerald-400">{status}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      </Card>
      <Card className="space-y-3">
        <p className="text-sm text-muted">Room status: {room?.status ?? "..."}</p>
        <div className="rounded-lg border border-border bg-surface-soft p-3 text-sm">
          <p>
            Host: <span className="text-foreground">{hostName}</span>
          </p>
          <p className="mt-1">
            Guest: <span className="text-foreground">{guestName}</span>
          </p>
        </div>
        <Button variant="outline" onClick={joinRoom} disabled={isHost || isRoomFull || joining}>
          {joining ? "Joining..." : "Join as guest"}
        </Button>
        <Button onClick={startMatch} disabled={!isHost || !isReady || starting}>
          {starting ? "Starting..." : "Start match"}
        </Button>
        {!isHost ? <p className="text-xs text-muted">Only host can start.</p> : null}
        {isHost && !isReady ? <p className="text-xs text-muted">Waiting for guest to join...</p> : null}
        {guestTakenByOther ? <p className="text-xs text-red-400">Room already has a different guest.</p> : null}
      </Card>
    </main>
  );
}

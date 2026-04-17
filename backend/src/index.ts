import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";

// Routes
import authRouter from "./routes/auth";
import roomsRouter from "./routes/rooms";
import matchesRouter from "./routes/matches";
import submissionsRouter from "./routes/submissions";
import problemsRouter from "./routes/problems";
import usersRouter from "./routes/users";
import leaderboardRouter from "./routes/leaderboard";
import aiRouter from "./routes/ai";

const app = express();
const httpServer = createServer(app);

app.use(cors());

// ─── CORS — single config, applied once, trailing slash stripped ──────────────
const clientUrl = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/$/, "");

app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);

// ─── Socket.io ────────────────────────────────────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: clientUrl,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ─── Socket JWT Auth Middleware ────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) return next(new Error("auth_required"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET ?? "secret") as {
      id: string;
      username: string;
      email: string;
    };
    socket.data.userId = payload.id;
    socket.data.username = payload.username;
    next();
  } catch {
    next(new Error("invalid_token"));
  }
});

// ─── Dead Man's Switch state ──────────────────────────────────────────────────
const idleWarningTimers = new Map<string, NodeJS.Timeout>();
const idleDeleteTimers = new Map<string, NodeJS.Timeout>();

function clearIdleTimers(key: string) {
  const wt = idleWarningTimers.get(key);
  const dt = idleDeleteTimers.get(key);
  if (wt) { clearTimeout(wt); idleWarningTimers.delete(key); }
  if (dt) { clearTimeout(dt); idleDeleteTimers.delete(key); }
}

function resetIdleTimer(matchId: string, userId: string) {
  const key = `${matchId}:${userId}`;
  clearIdleTimers(key);

  const warnTimer = setTimeout(() => {
    io.to(matchId).emit("match:idle_warning", {
      user_id: userId,
      seconds_idle: 45,
      seconds_until_delete: 10,
    });

    const deleteTimer = setTimeout(() => {
      io.to(matchId).emit("match:lines_deleted", {
        user_id: userId,
        lines_deleted: 5,
      });
      idleDeleteTimers.delete(key);
    }, 10_000);

    idleDeleteTimers.set(key, deleteTimer);
    idleWarningTimers.delete(key);
  }, 45_000);

  idleWarningTimers.set(key, warnTimer);
}

// ─── Match Timer state ────────────────────────────────────────────────────────
const matchIntervals = new Map<string, NodeJS.Timeout>();

export function startMatchTimer(matchId: string, timeLimitMs: number) {
  if (matchIntervals.has(matchId)) return;

  let remaining = timeLimitMs;

  const interval = setInterval(() => {
    remaining -= 1_000;
    io.to(matchId).emit("match:timer_tick", { remaining_ms: remaining });

    if (remaining <= 0) {
      stopMatchTimer(matchId);
      io.to(matchId).emit("match:ended", {
        winner_id: null,
        reason: "time_up",
        elo_deltas: {},
      });
    }
  }, 1_000);

  matchIntervals.set(matchId, interval);
  console.log(`[timer] started for match ${matchId} (${timeLimitMs / 60_000} min)`);
}

export function stopMatchTimer(matchId: string) {
  const interval = matchIntervals.get(matchId);
  if (interval) {
    clearInterval(interval);
    matchIntervals.delete(matchId);
    console.log(`[timer] stopped for match ${matchId}`);
  }
}

// ─── Socket connection handler ────────────────────────────────────────────────
io.on("connection", (socket) => {
  const userId: string = socket.data.userId;
  const username: string = socket.data.username;

  console.log(`[socket] connected: ${socket.id} (user: ${username})`);

  socket.on("room:join", ({ room_code }: { room_code: string }) => {
    socket.join(room_code);
    console.log(`[socket] ${username} joined room ${room_code}`);
  });

  socket.on("room:leave", ({ room_code }: { room_code: string }) => {
    socket.leave(room_code);
  });

  socket.on("code:update", ({ match_id }: { match_id: string; code_length: number; cursor_line: number }) => {
    socket.to(match_id).emit("match:opponent_typing", {
      is_typing: true,
      user_id: userId,
    });
  });

  socket.on(
    "code_change",
    (data: { roomCode: string; code: string; language: string; userId: string }) => {
      socket.to(data.roomCode).emit("opponent_code_change", {
        code: data.code,
        language: data.language,
        userId: data.userId,
      });
    }
  );

  socket.on("idle:heartbeat", ({ match_id }: { match_id: string }) => {
    if (!match_id) return;
    resetIdleTimer(match_id, userId);
  });

  socket.on("match:surrender", ({ match_id }: { match_id: string }) => {
    socket.to(match_id).emit("match:opponent_surrendered", { user_id: userId });
  });

  socket.on("spectator:join", ({ match_id }: { match_id: string }) => {
    socket.join(match_id);
    socket.to(match_id).emit("match:spectator_joined", { username });
  });

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id} (user: ${username})`);
    for (const key of idleWarningTimers.keys()) {
      if (key.endsWith(`:${userId}`)) clearIdleTimers(key);
    }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function broadcastSubmissionResult(
  matchId: string,
  payload: {
    user_id: string;
    verdict: string;
    test_cases_passed: number;
    test_cases_total: number;
    runtime_ms: number;
  }
) {
  io.to(matchId).emit("match:submission_result", payload);
  if (payload.verdict === "accepted") {
    io.to(matchId).emit("match:opponent_accepted", { user_id: payload.user_id });
  }
}

export function broadcastMatchEnded(
  matchId: string,
  payload: {
    winner_id: string | null;
    reason: "accepted" | "surrender" | "time_up";
    elo_deltas: Record<string, number>;
  }
) {
  stopMatchTimer(matchId);
  io.to(matchId).emit("match:ended", payload);
}

export function broadcastAiComment(matchId: string, comment: string) {
  io.to(matchId).emit("match:ai_comment", { comment, timestamp: Date.now() });
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "codeclash-api", timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/matches", matchesRouter);
app.use("/api/submissions", submissionsRouter);
app.use("/api/problems", problemsRouter);
app.use("/api/users", usersRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/ai", aiRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled error]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "5000", 10);

httpServer.listen(PORT, () => {
  console.log(`\n🚀 CodeClash API → http://localhost:${PORT}`);
  console.log(`   Health      GET  /health`);
  console.log(`   Auth        POST /api/auth/register | /login | GET /me`);
  console.log(`   Rooms       POST /api/rooms | GET /:code | POST /:code/join | /:code/start`);
  console.log(`   Matches     GET  /api/matches/:id | /history | GET /:id/debrief | POST /:id/surrender`);
  console.log(`   Submissions POST /api/submissions | GET /match/:matchId`);
  console.log(`   Problems    GET  /api/problems | /random | /:slug`);
  console.log(`   Users       GET  /api/users/:username | PATCH /me | GET /me/stats`);
  console.log(`   Leaderboard GET  /api/leaderboard`);
  console.log(`   AI          POST /api/ai/hint | /analyze | /roast | /comment | /autopsy | /complexity`);
  console.log(`\n   Socket.io ready (JWT auth required)\n`);
});
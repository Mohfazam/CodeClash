import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

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

// ─── Socket.io ────────────────────────────────────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL ?? "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on("join_room", (roomCode: string) => {
    socket.join(roomCode);
    console.log(`[socket] ${socket.id} joined room ${roomCode}`);
  });

  socket.on("leave_room", (roomCode: string) => {
    socket.leave(roomCode);
  });

  // Relay code changes to opponent (live cursor/code sync)
  socket.on("code_change", (data: { roomCode: string; code: string; language: string; userId: string }) => {
    socket.to(data.roomCode).emit("opponent_code_change", {
      code: data.code,
      language: data.language,
      userId: data.userId,
    });
  });

  socket.on("disconnect", () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173", credentials: true }));
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
  console.log(`   Matches     GET  /api/matches/:id | /history | POST /:id/surrender`);
  console.log(`   Submissions POST /api/submissions | GET /match/:matchId`);
  console.log(`   Problems    GET  /api/problems | /random | /:slug`);
  console.log(`   Users       GET  /api/users/:username | PATCH /me | GET /me/stats`);
  console.log(`   Leaderboard GET  /api/leaderboard`);
  console.log(`   AI          POST /api/ai/hint | /analyze | /comment | /autopsy`);
  console.log(`\n   Socket.io ready\n`);
});
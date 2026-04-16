import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

// Routes
import authRouter from "./routes/auth";

const app = express();
const httpServer = createServer(app);

// ─── Socket.io (wired up, ready for Phase 2) ──────────────────────────────────
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.VITE_SOCKET_URL ?? "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`[socket] client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[socket] client disconnected: ${socket.id}`);
  });
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.VITE_API_URL ?? "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "codeclash-api", timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRouter);

// Phase 2+ routes will be added here:
// app.use("/api/rooms",       roomsRouter);
// app.use("/api/matches",     matchesRouter);
// app.use("/api/submissions", submissionsRouter);
// app.use("/api/problems",    problemsRouter);
// app.use("/api/users",       usersRouter);
// app.use("/api/leaderboard", leaderboardRouter);
// app.use("/api/ai",          aiRouter);

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[unhandled error]", err);
  res.status(500).json({ error: "Internal server error" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "5000", 10);

httpServer.listen(PORT, () => {
  console.log(`\n🚀 CodeClash API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Auth:   http://localhost:${PORT}/api/auth`);
  console.log(`\n   Socket.io ready\n`);
});
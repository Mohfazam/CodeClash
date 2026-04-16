import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { rooms, users, matches, problems, matchEvents } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const createRoomSchema = z.object({
  options: z
    .object({
      time_limit_minutes: z.number().min(5).max(120).optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      topic: z.string().nullable().optional(),
      spectators_allowed: z.boolean().optional(),
      live_commentator: z.boolean().optional(),
      blind_rating: z.object({ enabled: z.boolean() }).optional(),
      dead_mans_switch: z.object({ enabled: z.boolean(), idle_seconds: z.number() }).optional(),
    })
    .optional(),
});

// POST /api/rooms — create a room
router.post("/", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  try {
    let roomCode: string;
    let attempts = 0;

    do {
      roomCode = generateRoomCode();
      const existing = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.roomCode, roomCode)).limit(1);
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < 10);

    const [room] = await db
      .insert(rooms)
      .values({ roomCode, hostId: req.user!.id, options: parsed.data.options ?? undefined })
      .returning();

    res.status(201).json(room);
  } catch (err) {
    console.error("[POST /rooms]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/rooms/:code — get room by code
router.get("/:code", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.roomCode, (req.params.code as string).toUpperCase()))
      .limit(1);

    if (!room) { res.status(404).json({ error: "Room not found" }); return; }

    const [host] = await db
      .select({ id: users.id, username: users.username, elo: users.elo })
      .from(users)
      .where(eq(users.id, room.hostId))
      .limit(1);

    let guest = null;
    if (room.guestId) {
      const [g] = await db
        .select({ id: users.id, username: users.username, elo: users.elo })
        .from(users)
        .where(eq(users.id, room.guestId))
        .limit(1);
      guest = g ?? null;
    }

    res.json({ ...room, host, guest });
  } catch (err) {
    console.error("[GET /rooms/:code]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/rooms/:code/join — guest joins room
router.post("/:code/join", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.roomCode, (req.params.code as string).toUpperCase()))
      .limit(1);

    if (!room) { res.status(404).json({ error: "Room not found" }); return; }
    if (room.status !== "waiting") { res.status(409).json({ error: "Room is not accepting players" }); return; }
    if (room.hostId === req.user!.id) { res.status(409).json({ error: "You are already the host of this room" }); return; }
    if (room.guestId) { res.status(409).json({ error: "Room is full" }); return; }

    const [updated] = await db
      .update(rooms)
      .set({ guestId: req.user!.id, status: "ready", updatedAt: new Date() })
      .where(eq(rooms.id, room.id))
      .returning();

    // Notify host via socket
    const { io } = await import("../index");
    const [guest] = await db
      .select({ id: users.id, username: users.username, elo: users.elo })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    io.to(room.roomCode).emit("room:guest_joined", { guest });

    res.json(updated);
  } catch (err) {
    console.error("[POST /rooms/:code/join]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/rooms/:code/start — host starts the match with countdown
router.post("/:code/start", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.roomCode, (req.params.code as string).toUpperCase()))
      .limit(1);

    if (!room) { res.status(404).json({ error: "Room not found" }); return; }
    if (room.hostId !== req.user!.id) { res.status(403).json({ error: "Only the host can start the match" }); return; }
    if (room.status !== "ready") { res.status(409).json({ error: "Room is not ready (need a guest)" }); return; }

    // Pick a problem
    const allProblems = await db.select().from(problems);
    let pool = allProblems;

    if (room.options?.difficulty) pool = pool.filter((p) => p.difficulty === room.options!.difficulty);
    if (room.options?.topic) pool = pool.filter((p) => p.topics.includes(room.options!.topic!));
    if (pool.length === 0) pool = allProblems;

    const problem = pool[Math.floor(Math.random() * pool.length)];

    // Create match
    const [match] = await db
      .insert(matches)
      .values({
        roomId: room.id,
        problemId: problem.id,
        player1Id: room.hostId,
        player2Id: room.guestId!,
      })
      .returning();

    // Update room status
    await db.update(rooms).set({ status: "active", updatedAt: new Date() }).where(eq(rooms.id, room.id));

    // Log match start event
    await db.insert(matchEvents).values({
      matchId: match.id,
      userId: null,
      eventType: "match_start",
      payload: { problem_id: problem.id, problem_title: problem.title },
    });

    const sanitizedProblem = {
      ...problem,
      testCases: problem.testCases?.filter((tc) => !tc.is_hidden) ?? [],
    };

    const timeLimitMs = ((room.options as any)?.time_limit_minutes ?? 30) * 60 * 1000;

    // Import socket helpers
    const { io, startMatchTimer } = await import("../index");

    // Emit countdown (5 seconds), then match:started
    io.to(room.roomCode).emit("room:countdown", { seconds: 5 });

    setTimeout(() => {
      io.to(room.roomCode).emit("match:started", {
        match_id: match.id,
        problem: sanitizedProblem,
        time_limit_ms: timeLimitMs,
      });

      // Join both players to the match room (by matchId) for further events
      // Clients should also call socket.join(match_id) on their side
      io.to(room.roomCode).emit("match:join_room", { match_id: match.id });

      // Start server-side countdown timer
      startMatchTimer(match.id, timeLimitMs);
    }, 5_000);

    res.status(201).json({ match, problem: sanitizedProblem });
  } catch (err) {
    console.error("[POST /rooms/:code/start]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/rooms/:code/options — host updates room options
router.patch("/:code/options", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.roomCode, (req.params.code as string).toUpperCase()))
      .limit(1);

    if (!room) { res.status(404).json({ error: "Room not found" }); return; }
    if (room.hostId !== req.user!.id) { res.status(403).json({ error: "Only the host can update options" }); return; }
    if (room.status === "active" || room.status === "done") {
      res.status(409).json({ error: "Cannot update options after match has started" }); return;
    }

    const mergedOptions = { ...(room.options ?? {}), ...(req.body.options ?? {}) };

    const [updated] = await db
      .update(rooms)
      .set({ options: mergedOptions, updatedAt: new Date() })
      .where(eq(rooms.id, room.id))
      .returning();

    // Notify guest via socket
    const { io } = await import("../index");
    io.to(room.roomCode).emit("room:options_updated", { options: mergedOptions });

    res.json(updated);
  } catch (err) {
    console.error("[PATCH /rooms/:code/options]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/rooms/:code — host closes room
router.delete("/:code", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.roomCode, (req.params.code as string).toUpperCase()))
      .limit(1);

    if (!room) { res.status(404).json({ error: "Room not found" }); return; }
    if (room.hostId !== req.user!.id) { res.status(403).json({ error: "Only the host can close the room" }); return; }

    await db.update(rooms).set({ status: "done", updatedAt: new Date() }).where(eq(rooms.id, room.id));

    const { io } = await import("../index");
    io.to(room.roomCode).emit("room:closed", { room_code: room.roomCode });

    res.json({ message: "Room closed" });
  } catch (err) {
    console.error("[DELETE /rooms/:code]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
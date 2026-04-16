import { Router, Request, Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { rooms, users, matches, problems } from "../db/schema";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

// Generates a 6-char room code, no 0/O/1/I
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
      dead_mans_switch: z
        .object({ enabled: z.boolean(), idle_seconds: z.number() })
        .optional(),
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

    // Collision-safe code generation
    do {
      roomCode = generateRoomCode();
      const existing = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(eq(rooms.roomCode, roomCode))
        .limit(1);
      if (existing.length === 0) break;
      attempts++;
    } while (attempts < 10);

    const [room] = await db
      .insert(rooms)
      .values({
        roomCode,
        hostId: req.user!.id,
        options: parsed.data.options ?? undefined,
      })
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

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    // Fetch host and guest info
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

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    if (room.status !== "waiting") {
      res.status(409).json({ error: "Room is not accepting players" });
      return;
    }
    if (room.hostId === req.user!.id) {
      res.status(409).json({ error: "You are already the host of this room" });
      return;
    }
    if (room.guestId) {
      res.status(409).json({ error: "Room is full" });
      return;
    }

    const [updated] = await db
      .update(rooms)
      .set({ guestId: req.user!.id, status: "ready", updatedAt: new Date() })
      .where(eq(rooms.id, room.id))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error("[POST /rooms/:code/join]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/rooms/:code/start — host starts the match
router.post("/:code/start", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.roomCode, (req.params.code as string).toUpperCase()))
      .limit(1);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    if (room.hostId !== req.user!.id) {
      res.status(403).json({ error: "Only the host can start the match" });
      return;
    }
    if (room.status !== "ready") {
      res.status(409).json({ error: "Room is not ready (need a guest)" });
      return;
    }

    // Pick a random problem based on room options
    const allProblems = await db.select().from(problems);
    let pool = allProblems;

    if (room.options?.difficulty) {
      pool = pool.filter((p) => p.difficulty === room.options!.difficulty);
    }
    if (room.options?.topic) {
      pool = pool.filter((p) => p.topics.includes(room.options!.topic!));
    }
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
    await db
      .update(rooms)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(rooms.id, room.id));

    const sanitizedProblem = {
      ...problem,
      testCases: problem.testCases?.filter((tc) => !tc.is_hidden) ?? [],
    };

    res.status(201).json({ match, problem: sanitizedProblem });
  } catch (err) {
    console.error("[POST /rooms/:code/start]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/rooms/:code — host closes/leaves room
router.delete("/:code", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [room] = await db
      .select()
      .from(rooms)
      .where(eq(rooms.roomCode, (req.params.code as string).toUpperCase()))
      .limit(1);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    if (room.hostId !== req.user!.id) {
      res.status(403).json({ error: "Only the host can close the room" });
      return;
    }

    await db.update(rooms).set({ status: "done", updatedAt: new Date() }).where(eq(rooms.id, room.id));

    res.json({ message: "Room closed" });
  } catch (err) {
    console.error("[DELETE /rooms/:code]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
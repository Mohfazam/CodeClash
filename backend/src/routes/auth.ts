import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";
import { requireAuth, signToken } from "../middleware/auth";

const router = Router();

const BCRYPT_ROUNDS = 12;

// ─── Validation schemas ───────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be at most 50 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ─── POST /api/auth/register ──────────────────────────────────────────────────

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { email, username, password } = parsed.data;

  try {
    // Check for existing email
    const existingEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingEmail.length > 0) {
      res.status(409).json({ error: "Email is already registered" });
      return;
    }

    // Check for existing username
    const existingUsername = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (existingUsername.length > 0) {
      res.status(409).json({ error: "Username is already taken" });
      return;
    }

    // Hash password & insert user
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // ✅ FIX: Don't destructure directly — guard against empty/undefined result
    const inserted = await db
      .insert(users)
      .values({ email, username, passwordHash })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        elo: users.elo,
      });

    const newUser = inserted[0];

    if (!newUser) {
      res.status(500).json({ error: "Failed to create user" });
      return;
    }

    const token = signToken(newUser);

    res.status(201).json({
      user: { id: newUser.id, username: newUser.username, elo: newUser.elo },
      token,
    });
  } catch (err) {
    console.error("[POST /auth/register]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        passwordHash: users.passwordHash,
        elo: users.elo,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken({ id: user.id, username: user.username, email: user.email });

    res.json({
      user: { id: user.id, username: user.username, elo: user.elo },
      token,
    });
  } catch (err) {
    console.error("[POST /auth/login]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

router.get("/me", requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        elo: users.elo,
        metadata: users.metadata,
        codeDna: users.codeDna,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (err) {
    console.error("[GET /auth/me]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
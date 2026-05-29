import { Router } from "express";
import { z } from "zod";
import {
  requireAuth,
  requireAdminAccess,
  signAccessToken,
  type AuthenticatedRequest
} from "../../common/security";
import { buildPlatformOverview } from "../platform/platform.service";
import { ensureBootstrap } from "../../bootstrap";
import { authenticateUser, createUser, listUsers } from "./users.service";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["admin", "operator", "viewer"]).default("operator")
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  await ensureBootstrap();

  const user = await authenticateUser(parsed.data.email, parsed.data.password);
  if (!user) {
    res.status(401).json({ error: "Credenciais inválidas." });
    return;
  }

  const accessToken = signAccessToken(user);
  res.json({
    accessToken,
    user,
    tokenType: "Bearer",
    expiresIn: process.env.JWT_EXPIRES_IN ?? "12h"
  });
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const platform = await buildPlatformOverview(req.user?.userId);
  res.json({
    user: req.user,
    platform
  });
});

authRouter.get("/users", requireAdminAccess, async (_req, res) => {
  const users = await listUsers();
  res.json({ items: users });
});

authRouter.post("/users", requireAdminAccess, async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const user = await createUser(parsed.data);
    res.status(201).json({ user });
  } catch {
    res.status(409).json({ error: "E-mail já cadastrado." });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.json({ ok: true, message: "Encerre o token no cliente (localStorage)." });
});

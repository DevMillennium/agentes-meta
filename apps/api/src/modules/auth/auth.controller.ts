import { Router } from "express";
import { z } from "zod";
import { authenticateAdminLogin, signAccessToken } from "../../common/security";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const user = authenticateAdminLogin(parsed.data.email, parsed.data.password);
  if (!user) {
    res.status(401).json({ error: "Credenciais inválidas." });
    return;
  }

  const accessToken = signAccessToken(user);
  res.json({
    accessToken,
    user
  });
});

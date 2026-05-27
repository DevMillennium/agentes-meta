import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../../common/security";
import { buildPlatformOverview } from "./platform.service";

export const platformRouter = Router();

/** Visão geral pública (sem segredos). */
platformRouter.get("/health", async (_req, res) => {
  res.json({
    ok: true,
    service: "phoenix-platform",
    timestamp: new Date().toISOString()
  });
});

/** Estado completo: agentes, stats, Meta — requer autenticação. */
platformRouter.get("/overview", requireAuth, async (req: AuthenticatedRequest, res) => {
  const overview = await buildPlatformOverview(req.user?.userId);
  res.json({
    ...overview,
    user: req.user ?? null
  });
});

import { Router } from "express";
import { getAiStatus } from "./ai.service";

export const aiRouter = Router();

aiRouter.get("/status", async (_req, res) => {
  const status = await getAiStatus();
  res.json(status);
});

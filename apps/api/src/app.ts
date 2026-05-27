import cors from "cors";
import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./common/logger";
import { AgentOrchestrator } from "./modules/agents/services/agent.orchestrator";
import { defaultAgents } from "./modules/agents/services/default-agents";
import { productsRouter } from "./modules/products/products.controller";
import { campaignsRouter } from "./modules/campaigns/campaigns.controller";
import { approvalsRouter } from "./modules/approvals/approvals.controller";

export function createApp(): express.Express {
  const app = express();
  const orchestrator = new AgentOrchestrator(defaultAgents);

  app.use(cors());
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "phoenix-api", timestamp: new Date().toISOString() });
  });

  app.use("/api/products", productsRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/approvals", approvalsRouter);

  app.post("/api/agents/orchestrate", async (req, res) => {
    const result = await orchestrator.runMarketingCycle({
      objective: req.body?.objective ?? "Vender produto prioritário",
      maxDailyBudget: Number(req.body?.maxDailyBudget ?? 50),
      productId: req.body?.productId ?? "placeholder-product-id",
      campaignType: req.body?.campaignType ?? "messages"
    });
    res.json(result);
  });

  app.post("/webhooks/whatsapp", (req, res) => {
    res.json({
      message: "Webhook WhatsApp recebido (placeholder).",
      event: req.body ?? {}
    });
  });

  app.post("/webhooks/instagram", (req, res) => {
    res.json({
      message: "Webhook Instagram Direct recebido (placeholder).",
      event: req.body ?? {}
    });
  });

  return app;
}

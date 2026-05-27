import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { logger } from "./common/logger";
import { AgentOrchestrator } from "./modules/agents/services/agent.orchestrator";
import { defaultAgents } from "./modules/agents/services/default-agents";
import { productsRouter } from "./modules/products/products.controller";
import { campaignsRouter } from "./modules/campaigns/campaigns.controller";
import { approvalsRouter } from "./modules/approvals/approvals.controller";
import { authRouter } from "./modules/auth/auth.controller";
import { env } from "./config/env";
import { prisma } from "./common/prisma";
import { requireOperatorAccess, verifyMetaSignature } from "./common/security";
import { enqueueAgentOrchestrationJob } from "./queues/agent-jobs.queue";
import {
  parseInboundEvents,
  parseWhatsAppDeliveryStatuses
} from "./modules/webhooks/services/inbound-events.parser";
import { enqueueInboundMessageEvent } from "./queues/inbound-messages.queue";
import { processInboundMessageEvent } from "./modules/webhooks/services/inbound-events.service";
import { recordWhatsAppDeliveryStatuses } from "./modules/webhooks/services/delivery-status.service";

export function createApp(): express.Express {
  const app = express();
  const orchestrator = new AgentOrchestrator(defaultAgents);
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false
  });

  app.use(
    cors({
      origin: env.API_CORS_ORIGIN
    })
  );
  app.use(helmet());
  app.use(apiLimiter);
  app.use(pinoHttp({ logger }));
  app.use(
    "/webhooks",
    express.raw({
      type: "*/*"
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "phoenix-api", timestamp: new Date().toISOString() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/products", requireOperatorAccess, productsRouter);
  app.use("/api/campaigns", requireOperatorAccess, campaignsRouter);
  app.use("/api/approvals", requireOperatorAccess, approvalsRouter);

  app.post("/api/agents/orchestrate", requireOperatorAccess, async (req, res) => {
    const userId = String(req.body?.userId ?? "system");
    const result = await orchestrator.runMarketingCycle({
      objective: req.body?.objective ?? "Vender produto prioritário",
      maxDailyBudget: Number(req.body?.maxDailyBudget ?? 50),
      productId: req.body?.productId ?? "placeholder-product-id",
      campaignType: req.body?.campaignType ?? "messages"
    }, userId);

    await prisma.agentAction.create({
      data: {
        agentName: "AgentOrchestrator",
        actionType: "run_marketing_cycle",
        targetType: "campaign_flow",
        targetId: req.body?.productId ? String(req.body.productId) : null,
        reason: result.message,
        riskLevel: result.data && "pendingApproval" in (result.data as object) ? "MEDIUM" : "LOW",
        status: result.success ? "SUCCESS" : "BLOCKED",
        beforeData: req.body ?? {},
        afterData: result.data ? (result.data as object) : {}
      }
    });

    const pendingApproval = (result.data as { pendingApproval?: { riskLevel: "low" | "medium" | "high"; reason: string; payload: unknown; agentName: string } } | undefined)?.pendingApproval;
    if (pendingApproval) {
      await prisma.approvalRequest.create({
        data: {
          title: `Aprovação requerida: ${pendingApproval.agentName}`,
          description: pendingApproval.reason,
          riskLevel: pendingApproval.riskLevel.toUpperCase() as "LOW" | "MEDIUM" | "HIGH",
          requestedBy: userId,
          requestedData: pendingApproval.payload as object
        }
      });
    }

    await enqueueAgentOrchestrationJob({
      traceId: String((result.data as { traceId?: string } | undefined)?.traceId ?? "not-provided"),
      productId: String(req.body?.productId ?? "placeholder-product-id"),
      objective: String(req.body?.objective ?? "Vender produto prioritário"),
      riskLevel: result.data && "pendingApproval" in (result.data as object) ? "MEDIUM" : "LOW",
      requestedBy: userId
    });

    res.json(result);
  });

  app.get("/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send("forbidden");
  });

  app.post("/webhooks/whatsapp", (req, res) => {
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : "";
    if (!verifyMetaSignature(rawBody, req.header("x-hub-signature-256") ?? undefined)) {
      res.status(401).json({ error: "Assinatura inválida." });
      return;
    }
    let event: object = {};
    try {
      event = JSON.parse(rawBody || "{}") as object;
    } catch {
      res.status(400).json({ error: "Payload inválido." });
      return;
    }
    const inboundEvents = parseInboundEvents("whatsapp", event);
    const deliveryStatuses = parseWhatsAppDeliveryStatuses(event);
    for (const inboundEvent of inboundEvents) {
      if (env.ENABLE_WORKERS) {
        void enqueueInboundMessageEvent(inboundEvent);
      } else {
        void processInboundMessageEvent(inboundEvent);
      }
    }
    void recordWhatsAppDeliveryStatuses(deliveryStatuses);
    res.json({
      message: "Webhook WhatsApp recebido com assinatura válida.",
      queuedEvents: inboundEvents.length,
      deliveryStatuses: deliveryStatuses.length
    });
  });

  app.get("/webhooks/instagram", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send("forbidden");
  });

  app.post("/webhooks/instagram", (req, res) => {
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : "";
    if (!verifyMetaSignature(rawBody, req.header("x-hub-signature-256") ?? undefined)) {
      res.status(401).json({ error: "Assinatura inválida." });
      return;
    }
    let event: object = {};
    try {
      event = JSON.parse(rawBody || "{}") as object;
    } catch {
      res.status(400).json({ error: "Payload inválido." });
      return;
    }
    const inboundEvents = parseInboundEvents("instagram", event);
    for (const inboundEvent of inboundEvents) {
      if (env.ENABLE_WORKERS) {
        void enqueueInboundMessageEvent(inboundEvent);
      } else {
        void processInboundMessageEvent(inboundEvent);
      }
    }
    res.json({
      message: "Webhook Instagram Direct recebido com assinatura válida.",
      queuedEvents: inboundEvents.length
    });
  });

  return app;
}

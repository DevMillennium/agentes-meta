import cors from "cors";
import express from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { agentsRouter } from "./modules/agents/agents.controller";
import { platformRouter } from "./modules/platform/platform.controller";
import { productsRouter } from "./modules/products/products.controller";
import { campaignsRouter } from "./modules/campaigns/campaigns.controller";
import { conversationsRouter } from "./modules/conversations/conversations.controller";
import { leadsRouter } from "./modules/leads/leads.controller";
import { approvalsRouter } from "./modules/approvals/approvals.controller";
import { authRouter } from "./modules/auth/auth.controller";
import { env, getCorsOrigins } from "./config/env";
import { prisma } from "./common/prisma";
import { requireAuth, requireOperatorAccess, verifyMetaSignature } from "./common/security";
import {
  parseInboundEvents,
  parseWhatsAppDeliveryStatuses
} from "./modules/webhooks/services/inbound-events.parser";
import { enqueueInboundMessageEvent } from "./queues/inbound-messages.queue";
import { processInboundMessageEvent } from "./modules/webhooks/services/inbound-events.service";
import { recordWhatsAppDeliveryStatuses } from "./modules/webhooks/services/delivery-status.service";
import { registerBrowserEmulatorRoutes } from "./dev/browser-emulator.routes";
import { registerBrowserConsoleRoutes } from "./console/browser-console.routes";
import { registerBrowserHubRoutes } from "./hub/browser-hub.routes";
import { registerBrowserLeadsRoutes } from "./tools/browser-leads.routes";
import { registerBrowserAuthRoutes } from "./shared/browser-auth.routes";
import { AGENT_CATALOG } from "./modules/agents/services/agent-catalog";
import { metaRouter } from "./modules/meta/meta.controller";
import { ensureBootstrap, getBootstrapError, isBootstrapped } from "./bootstrap";

export function createApp(): express.Express {
  const app = express();
  app.set("trust proxy", 1);
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: false,
    legacyHeaders: false,
    validate: {
      ip: false
    }
  });
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: false,
    legacyHeaders: false,
    validate: {
      ip: false
    },
    message: { error: "Muitas tentativas de autenticação. Tente novamente em alguns minutos." }
  });
  const webhookLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 180,
    standardHeaders: false,
    legacyHeaders: false,
    validate: {
      ip: false
    },
    message: { error: "Muitas chamadas de webhook. Tente novamente." }
  });

  const corsOrigins = getCorsOrigins();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true
    })
  );
  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false
    })
  );
  app.use("/api", apiLimiter);
  app.use("/api/auth/login", authLimiter);
  app.use(pinoHttp());
  app.use(
    "/webhooks",
    webhookLimiter,
    express.raw({
      type: "*/*"
    })
  );
  app.use(express.json());

  app.get("/health", (_req, res) => {
    const ready = isBootstrapped();
    if (!ready) {
      // Auto-recuperação: dispara nova tentativa (idempotente) sem bloquear a resposta.
      void ensureBootstrap();
    }
    const bootstrapErr = getBootstrapError();
    const ok = ready || !bootstrapErr;
    res.status(ok ? 200 : 503).json({
      ok,
      service: "phoenix-api",
      ready,
      timestamp: new Date().toISOString(),
      bootstrapError: ready ? null : bootstrapErr
    });
  });

  registerBrowserAuthRoutes(app);
  registerBrowserHubRoutes(app);
  registerBrowserConsoleRoutes(app);
  registerBrowserEmulatorRoutes(app);
  registerBrowserLeadsRoutes(app);

  app.get("/api/agents/catalog", (_req, res) => {
    res.json({ items: AGENT_CATALOG, total: AGENT_CATALOG.length, public: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/platform", platformRouter);
  app.use("/api/meta", metaRouter);
  app.use("/api/agents", requireOperatorAccess, agentsRouter);
  app.use("/api/products", requireOperatorAccess, productsRouter);
  app.use("/api/campaigns", requireOperatorAccess, campaignsRouter);
  app.use("/api/leads", requireOperatorAccess, leadsRouter);
  app.use("/api/conversations", requireOperatorAccess, conversationsRouter);
  app.use("/api/approvals", requireOperatorAccess, approvalsRouter);

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

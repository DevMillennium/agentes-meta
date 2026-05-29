import type { Express, Request, Response } from "express";
import { env } from "../../config/env";
import { logger } from "../../common/logger";
import { verifyMetaSignature } from "../../common/security";
import { metaWebhookService } from "./meta-webhook.service";

const log = logger.child({ module: "meta-webhook-controller" });

function readRawBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  return "";
}

/**
 * FASE 4 — Webhook Meta unificado (Instagram + Messenger + WhatsApp).
 *
 * Registrado de forma ADITIVA: os endpoints legados
 * /webhooks/whatsapp e /webhooks/instagram continuam funcionando.
 * Aponte o app Meta para /webhooks/meta para usar o pipeline Chatwoot.
 */
export function registerMetaWebhookRoutes(app: Express): void {
  // Verificação (hub.challenge)
  app.get("/webhooks/meta", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === env.META_WEBHOOK_VERIFY_TOKEN) {
      log.info("Webhook Meta verificado com sucesso.");
      res.status(200).send(challenge);
      return;
    }
    log.warn({ mode }, "Falha na verificação do webhook Meta (token inválido).");
    res.status(403).send("forbidden");
  });

  // Recebimento de eventos
  app.post("/webhooks/meta", async (req: Request, res: Response) => {
    const rawBody = readRawBody(req);
    if (!verifyMetaSignature(rawBody, req.header("x-hub-signature-256") ?? undefined)) {
      log.warn("Assinatura Meta inválida.");
      res.status(401).json({ error: "Assinatura inválida." });
      return;
    }

    let payload: unknown = {};
    try {
      payload = JSON.parse(rawBody || "{}");
    } catch {
      res.status(400).json({ error: "Payload inválido." });
      return;
    }

    // Responde rápido ao Meta (ack) e processa em background.
    res.status(200).json({ received: true });

    try {
      const results = await metaWebhookService.processPayload(payload);
      if (results.length) {
        log.info({ results }, "Eventos Meta processados.");
      }
    } catch (error) {
      log.error({ error: error instanceof Error ? error.message : error }, "Erro ao processar webhook Meta.");
    }
  });
}

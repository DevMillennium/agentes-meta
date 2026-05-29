import type { Express, Request, Response } from "express";
import { env } from "../../config/env";
import { logger } from "../../common/logger";
import { chatwootWebhookService } from "./chatwoot-webhook.service";

const log = logger.child({ module: "chatwoot-webhook-controller" });

function readJsonBody(req: Request): any {
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString("utf8") || "{}");
    } catch {
      return null;
    }
  }
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return null;
    }
  }
  return req.body ?? {};
}

/**
 * Validação opcional por segredo compartilhado.
 * Como o Chatwoot não assina os webhooks por padrão, aceitamos o segredo
 * via query (?secret=) ou header (x-webhook-token). Se CHATWOOT_WEBHOOK_SECRET
 * não estiver definido, não exigimos (proteja por rede/URL secreta).
 */
function validateSecret(req: Request): boolean {
  const expected = env.CHATWOOT_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const provided =
    (typeof req.query.secret === "string" ? req.query.secret : "") ||
    req.header("x-webhook-token") ||
    "";
  return provided === expected;
}

/** FASE 8 — POST /webhooks/chatwoot */
export function registerChatwootWebhookRoutes(app: Express): void {
  app.post("/webhooks/chatwoot", async (req: Request, res: Response) => {
    if (!validateSecret(req)) {
      log.warn("Segredo do webhook Chatwoot inválido.");
      res.status(401).json({ error: "Não autorizado." });
      return;
    }

    const payload = readJsonBody(req);
    if (!payload) {
      res.status(400).json({ error: "Payload inválido." });
      return;
    }

    // Ack rápido + processamento assíncrono.
    res.status(200).json({ received: true });

    try {
      const result = await chatwootWebhookService.process(payload);
      log.info({ result, event: payload?.event }, "Webhook Chatwoot processado.");
    } catch (error) {
      log.error({ error: error instanceof Error ? error.message : error }, "Erro no webhook Chatwoot.");
    }
  });
}

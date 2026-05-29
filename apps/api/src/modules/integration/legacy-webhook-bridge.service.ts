import { env } from "../../config/env";
import { logger } from "../../common/logger";
import { metaWebhookService } from "./meta-webhook.service";

const log = logger.child({ module: "legacy-webhook-bridge" });

/**
 * Garante que payloads legados (sem `object`) sejam normalizáveis
 * pelo MessageNormalizer sem alterar URLs no app Meta.
 */
export function ensureMetaWebhookObject(
  payload: Record<string, unknown>,
  channel: "whatsapp" | "instagram"
): Record<string, unknown> {
  if (typeof payload.object === "string" && payload.object.trim()) {
    return payload;
  }
  return {
    ...payload,
    object: channel === "whatsapp" ? "whatsapp_business_account" : "instagram"
  };
}

async function forwardToOmnichannelApi(
  rawBody: string,
  signature: string | undefined,
  channel: "whatsapp" | "instagram"
): Promise<void> {
  const base = env.OMNICHANNEL_API_URL?.trim().replace(/\/$/, "");
  if (!base) return;

  const response = await fetch(`${base}/webhooks/${channel}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature ? { "x-hub-signature-256": signature } : {})
    },
    body: rawBody
  });

  if (!response.ok) {
    throw new Error(`Forward omnichannel falhou: HTTP ${response.status}`);
  }
}

/**
 * Ponte Chatwoot + IA a partir dos webhooks LEGADOS (/webhooks/whatsapp, /webhooks/instagram).
 * O app Meta continua apontando para as mesmas URLs — zero alteração no Developer Console.
 */
export function bridgeLegacyWebhookToChatwoot(
  payload: Record<string, unknown>,
  channel: "whatsapp" | "instagram",
  options?: { rawBody?: string; signature?: string }
): void {
  const omnichannelUrl = env.OMNICHANNEL_API_URL?.trim();
  if (omnichannelUrl && options?.rawBody) {
    void forwardToOmnichannelApi(options.rawBody, options.signature, channel).catch((error) => {
      log.error(
        { error: error instanceof Error ? error.message : error, channel, omnichannelUrl },
        "Falha ao encaminhar webhook para Phoenix Digital Agents."
      );
    });
    return;
  }

  if (!env.CHATWOOT_ENABLED) return;

  const enriched = ensureMetaWebhookObject(payload, channel);
  void metaWebhookService.processPayload(enriched).catch((error) => {
    log.error(
      { error: error instanceof Error ? error.message : error, channel },
      "Falha na ponte legado → Chatwoot."
    );
  });
}
